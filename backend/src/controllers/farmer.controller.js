const { validate, createListingSchema, updateListingSchema, updateProfileSchema, photoSlotSchema, receiptUploadSchema, createListingExtSchema, schemeApplicationSchema } = require('../utils/validators');
const { success, error, paginated } = require('../utils/response.utils');
const { uploadFile, validatePhotoDimensions, validateFile, imageDimensions } = require('../services/upload.service');
const pool = require('../db');

async function getProfile(req, res) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return error(res, 'User not found', 404);
    const user = result.rows[0];
    const profile = await pool.query('SELECT * FROM farmer_profiles WHERE user_id = $1', [req.user.id]);
    return success(res, { ...user, profile: profile.rows[0] || null });
}

async function updateProfile(req, res) {
    const validation = validate(updateProfileSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const fields = [];
    const params = [];
    let idx = 1;
    const data = validation.value;

    if (data.name) { fields.push(`name = $${idx++}`); params.push(data.name); }
    if (data.district) { fields.push(`district = $${idx++}`); params.push(data.district); }
    if (data.state) { fields.push(`state = $${idx++}`); params.push(data.state); }

    if (fields.length > 0) {
        fields.push('updated_at = NOW()');
        params.push(req.user.id);
        await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, params);
    }

    if (data.land_acres !== undefined || data.crops !== undefined) {
        await pool.query(
            `INSERT INTO farmer_profiles (user_id, land_acres, crops)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id)
             DO UPDATE SET land_acres = COALESCE($2, farmer_profiles.land_acres),
                           crops = COALESCE($3, farmer_profiles.crops)`,
            [req.user.id, data.land_acres || null, data.crops || null]
        );
    }

    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    return success(res, user.rows[0], 'Profile updated');
}

async function getListings(req, res) {
    const result = await pool.query(
        `SELECT l.*,
                COALESCE(
                    json_agg(json_build_object('slot', lp.slot, 'file_url', lp.file_url, 'width_px', lp.width_px, 'height_px', lp.height_px))
                    FILTER (WHERE lp.id IS NOT NULL),
                    '[]'
                ) AS photos
         FROM listings l
         LEFT JOIN listing_photos lp ON lp.listing_id = l.id
         WHERE l.farmer_id = $1 AND l.is_bulk = false
         GROUP BY l.id
         ORDER BY l.created_at DESC`,
        [req.user.id]
    );
    const { hydrateFileUrls } = require('../services/upload.service');
    await hydrateFileUrls(result.rows, [{ field: 'photos', nested: true }, 'receipt_url']);
    return success(res, result.rows);
}

async function createListing(req, res) {
    const validation = validate(createListingSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const data = validation.value;
    const result = await pool.query(
        `INSERT INTO listings (farmer_id, crop, quantity_quintal, price_per_quintal, grade, description, is_bulk, district, status)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7, 'Pending')
         RETURNING *`,
        [req.user.id, data.crop, data.quantity_quintal, data.price_per_quintal, data.grade, data.description || null, data.district || null]
    );
    return success(res, result.rows[0], 'Listing created', 201);
}

async function updateListing(req, res) {
    const { id } = req.params;
    const validation = validate(updateListingSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const owned = await pool.query(
        'SELECT * FROM listings WHERE id = $1 AND farmer_id = $2',
        [id, req.user.id]
    );
    if (owned.rows.length === 0) return error(res, 'Listing not found or unauthorized', 404);

    const data = { ...validation.value };
    const isUpdatingDetails = data.crop || data.quantity_quintal || data.price_per_quintal || data.grade || data.description;
    if (isUpdatingDetails) {
        data.status = 'Pending';
    }

    const fields = []; const params = []; let idx = 1;
    for (const [key, value] of Object.entries(data)) {
        const dbKey = key === 'quantity_quintal' ? 'quantity_quintal' : key === 'price_per_quintal' ? 'price_per_quintal' : key;
        fields.push(`${dbKey} = $${idx++}`);
        params.push(value);
    }
    if (fields.length > 0) {
        params.push(id);
        const result = await pool.query(
            `UPDATE listings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        return success(res, result.rows[0], 'Listing updated');
    }
    return success(res, owned.rows[0], 'No changes');
}

async function deleteListing(req, res) {
    const { id } = req.params;
    const result = await pool.query(
        'DELETE FROM listings WHERE id = $1 AND farmer_id = $2 RETURNING *',
        [id, req.user.id]
    );
    if (result.rows.length === 0) return error(res, 'Listing not found or unauthorized', 404);
    return success(res, null, 'Listing deleted');
}

async function getEligibleSchemes(req, res) {
    const schemeService = require('../services/scheme.service');
    const schemes = await schemeService.getEligibleSchemes('farmer');
    return success(res, schemes);
}

async function applyForScheme(req, res) {
    const { id } = req.params;
    const validation = validate(schemeApplicationSchema, { ...req.body, scheme_id: id });
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const data = validation.value;
    const schemeService = require('../services/scheme.service');
    const existing = await schemeService.applyForScheme(req.user.id, id);
    if (existing.applied) return error(res, 'Already applied to this scheme', 400);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE scheme_applications
             SET full_name = $1, dob = $2, gender = $3, mobile = $4, email = $5, category = $6
             WHERE user_id = $7 AND scheme_id = $8
             RETURNING *`,
            [data.full_name, data.dob, data.gender, data.mobile, data.email || null, data.category || null,
             req.user.id, id]
        );

        if (req.files && req.files.photo) {
            const uploadService = require('../services/upload.service');
            const photoKey = await uploadService.uploadFile(req.files.photo[0].buffer, req.files.photo[0].mimetype, 'scheme-applications/photos');
            await client.query(
                `UPDATE scheme_applications SET photo_url = $1 WHERE id = $2`,
                [photoKey, result.rows[0].id]
            );
        }

        if (req.files) {
            const uploadService = require('../services/upload.service');
            const docTypes = ['aadhaar', 'pan', 'voter_id', 'driving_licence', 'passport',
                              'electricity_bill', 'ration_card', 'caste_certificate',
                              'ews_certificate', 'disability_certificate', 'minority_certificate'];
            for (const docType of docTypes) {
                if (req.files[docType] && req.files[docType].length > 0) {
                    const file = req.files[docType][0];
                    const fileKey = await uploadService.uploadFile(file.buffer, file.mimetype, `scheme-applications/documents`);
                    await client.query(
                        `INSERT INTO scheme_application_documents (application_id, doc_type, file_url, mime_type)
                         VALUES ($1, $2, $3, $4)`,
                        [result.rows[0].id, docType, fileKey, file.mimetype]
                    );
                }
            }
        }

        await client.query('COMMIT');

        const application = await client.query(
            `SELECT sa.*,
                    COALESCE(json_agg(json_build_object('doc_type', sad.doc_type, 'file_url', sad.file_url))
                        FILTER (WHERE sad.id IS NOT NULL), '[]') as documents
             FROM scheme_applications sa
             LEFT JOIN scheme_application_documents sad ON sad.application_id = sa.id
             WHERE sa.id = $1
             GROUP BY sa.id`,
            [result.rows[0].id]
        );

        const { hydrateFileUrls } = require('../services/upload.service');
        await hydrateFileUrls(application.rows, [{ field: 'documents', nested: true }, 'photo_url']);
        return success(res, application.rows[0], 'Application submitted', 201);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function getMySchemeApplications(req, res) {
    const result = await pool.query(
        `SELECT sa.*, s.name as scheme_name, s.name_hindi, s.benefit_amount, s.implementing_agency,
                COALESCE(json_agg(json_build_object('doc_type', sad.doc_type, 'file_url', sad.file_url))
                    FILTER (WHERE sad.id IS NOT NULL), '[]') as documents
         FROM scheme_applications sa
         JOIN schemes s ON sa.scheme_id = s.id
         LEFT JOIN scheme_application_documents sad ON sad.application_id = sa.id
         WHERE sa.user_id = $1
         GROUP BY sa.id, s.name, s.name_hindi, s.benefit_amount, s.implementing_agency
         ORDER BY sa.created_at DESC`,
        [req.user.id]
    );
    const { hydrateFileUrls } = require('../services/upload.service');
    await hydrateFileUrls(result.rows, [{ field: 'documents', nested: true }, 'photo_url']);
    return success(res, result.rows);
}

async function getPrices(req, res) {
    const priceService = require('../services/price.service');
    const prices = await priceService.getLatestPrices();
    return success(res, prices);
}

// ─── Verification Status (own record, redacted) ────────────

async function getVerificationStatus(req, res) {
    const user = await pool.query(
        "SELECT id, name, mobile, district, state, kyc_status, updated_at FROM users WHERE id = $1 AND role = 'farmer'",
        [req.user.id]
    );
    if (user.rows.length === 0) return error(res, 'User not found', 404);

    const audit = await pool.query(
        `SELECT new_status, reason, reviewer_role, created_at
         FROM verification_audit
         WHERE farmer_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
    );

    return success(res, {
        currentKycStatus: user.rows[0].kyc_status,
        lastUpdated: user.rows[0].updated_at,
        timeline: audit.rows.map(r => ({
            status: r.new_status,
            reason: r.reason,
            reviewerRole: r.reviewer_role === 'officer' ? 'Officer' : 'FPO',
            timestamp: r.created_at
        }))
    });
}

// ─── Submit for Review (ensures all 3 photos exist) ────────────

async function submitForReview(req, res) {
    const { id } = req.params;
    const owned = await pool.query(
        'SELECT id, status FROM listings WHERE id = $1 AND farmer_id = $2',
        [id, req.user.id]
    );
    if (owned.rows.length === 0) return error(res, 'Listing not found or unauthorized', 404);
    if (owned.rows[0].status !== 'Pending') return error(res, 'Listing is not in Pending status', 400);

    const photos = await pool.query(
        "SELECT slot FROM listing_photos WHERE listing_id = $1 AND slot IN ('overview','closeup','quality_detail')",
        [id]
    );
    const present = new Set(photos.rows.map(r => r.slot));
    const required = ['overview', 'closeup', 'quality_detail'];
    const missing = required.filter(s => !present.has(s));
    if (missing.length > 0) {
        return error(res, `Cannot submit — missing photos: ${missing.join(', ')}`, 400);
    }

    return success(res, { listingId: id, status: owned.rows[0].status }, 'Listing submitted for verification');
}

// ─── Photo Upload (per-slot) ────────────────────────────────

async function uploadPhoto(req, res) {
    const { listingId, slot } = req.params;
    const slotValidation = validate(photoSlotSchema, { slot });
    if (!slotValidation.valid) return error(res, 'Invalid photo slot', 400, slotValidation.errors);

    const owned = await pool.query(
        'SELECT id, status FROM listings WHERE id = $1 AND farmer_id = $2',
        [listingId, req.user.id]
    );
    if (owned.rows.length === 0) return error(res, 'Listing not found or unauthorized', 404);
    if (!['Pending', 'Rejected'].includes(owned.rows[0].status)) {
        return error(res, 'Cannot upload photos once listing is under review', 400);
    }

    if (!req.file) return error(res, 'No file uploaded', 400);

    const fileVal = validateFile(req.file.mimetype, req.file.size);
    if (!fileVal.valid) return error(res, fileVal.message, 400);

    // Only images allowed for photo slots
    if (!req.file.mimetype.startsWith('image/')) {
        return error(res, 'Photo slots require an image file (JPEG/PNG/WebP)', 400);
    }

    const dims = await imageDimensions(req.file.buffer);
    if (!dims) return error(res, 'Could not read image dimensions', 400);

    const dimVal = validatePhotoDimensions(dims.width, dims.height, slot);
    if (!dimVal.valid) return error(res, dimVal.message, 400);

    const key = await uploadFile(req.file.buffer, req.file.mimetype, `listings/${listingId}/photos`);

    await pool.query(
        `INSERT INTO listing_photos (listing_id, slot, file_url, width_px, height_px, file_size_bytes, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (listing_id, slot) DO UPDATE
         SET file_url = EXCLUDED.file_url, width_px = EXCLUDED.width_px,
             height_px = EXCLUDED.height_px, file_size_bytes = EXCLUDED.file_size_bytes,
             mime_type = EXCLUDED.mime_type`,
        [listingId, slot, key, dims.width, dims.height, req.file.size, req.file.mimetype]
    );

    const { hydrateFileUrls } = require('../services/upload.service');
    const result = await hydrateFileUrls({ file_url: key }, ['file_url']);
    return success(res, { slot, file_url: result.file_url, width: dims.width, height: dims.height }, `${slot} photo uploaded`);
}

// ─── Receipt Upload ──────────────────────────────────────────

async function uploadReceipt(req, res) {
    const { listingId } = req.params;

    const owned = await pool.query(
        'SELECT id FROM listings WHERE id = $1 AND farmer_id = $2',
        [listingId, req.user.id]
    );
    if (owned.rows.length === 0) return error(res, 'Listing not found or unauthorized', 404);

    if (!req.file) return error(res, 'No file uploaded', 400);

    const fileVal = validateFile(req.file.mimetype, req.file.size);
    if (!fileVal.valid) return error(res, fileVal.message, 400);

    const key = await uploadFile(req.file.buffer, req.file.mimetype, `listings/${listingId}/receipt`);

    await pool.query(
        `UPDATE listings SET receipt_url = $1, receipt_mime_type = $2, receipt_uploaded_at = NOW()
         WHERE id = $3`,
        [key, req.file.mimetype, listingId]
    );

    const { hydrateFileUrls } = require('../services/upload.service');
    const result = await hydrateFileUrls({ receipt_url: key }, ['receipt_url']);
    return success(res, { receipt_url: result.receipt_url, mime_type: req.file.mimetype }, 'Receipt uploaded');
}

module.exports = {
    getProfile, updateProfile,
    getListings, createListing, updateListing, deleteListing,
    getEligibleSchemes, applyForScheme, getMySchemeApplications, getPrices,
    getVerificationStatus,
    submitForReview,
    uploadPhoto, uploadReceipt
};
