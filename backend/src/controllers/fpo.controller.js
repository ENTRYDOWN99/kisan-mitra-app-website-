const { validate, createListingSchema, updateListingSchema, updateProfileSchema, fpoVerificationSchema, fpoListingVerificationSchema, schemeAppReviewSchema } = require('../utils/validators');
const { success, error } = require('../utils/response.utils');
const pool = require('../db');

async function getProfile(req, res) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return error(res, 'User not found', 404);
    const profile = await pool.query('SELECT * FROM fpo_profiles WHERE user_id = $1', [req.user.id]);
    return success(res, { ...result.rows[0], profile: profile.rows[0] || null });
}

async function updateProfile(req, res) {
    const validation = validate(updateProfileSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const fields = []; const params = []; let idx = 1;
    const data = validation.value;
    if (data.name) { fields.push(`name = $${idx++}`); params.push(data.name); }
    if (data.district) { fields.push(`district = $${idx++}`); params.push(data.district); }
    if (data.state) { fields.push(`state = $${idx++}`); params.push(data.state); }
    if (fields.length > 0) {
        fields.push('updated_at = NOW()');
        params.push(req.user.id);
        await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, params);
    }
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    return success(res, user.rows[0], 'Profile updated');
}

async function getMembers(req, res) {
    const result = await pool.query(
        `SELECT u.id, u.name, u.mobile, u.district, u.kyc_status, fp.land_acres, fp.crops, fm.joined_at
         FROM fpo_members fm
         JOIN users u ON fm.farmer_id = u.id
         LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
         WHERE fm.fpo_id = $1
         ORDER BY fm.joined_at DESC`,
        [req.user.id]
    );
    return success(res, result.rows);
}

async function addMember(req, res) {
    const { farmerId } = req.params;
    const farmer = await pool.query('SELECT * FROM users WHERE id = $1 AND role = $2', [farmerId, 'farmer']);
    if (farmer.rows.length === 0) return error(res, 'Farmer not found', 404);

    const existing = await pool.query(
        'SELECT * FROM fpo_members WHERE fpo_id = $1 AND farmer_id = $2',
        [req.user.id, farmerId]
    );
    if (existing.rows.length > 0) return error(res, 'Farmer is already a member', 400);

    await pool.query(
        'INSERT INTO fpo_members (fpo_id, farmer_id) VALUES ($1, $2)',
        [req.user.id, farmerId]
    );
    await pool.query(
        'UPDATE fpo_profiles SET member_count = member_count + 1 WHERE user_id = $1',
        [req.user.id]
    );
    return success(res, null, 'Member added', 201);
}

async function removeMember(req, res) {
    const { farmerId } = req.params;
    const result = await pool.query(
        'DELETE FROM fpo_members WHERE fpo_id = $1 AND farmer_id = $2 RETURNING *',
        [req.user.id, farmerId]
    );
    if (result.rows.length === 0) return error(res, 'Member not found', 404);
    await pool.query(
        'UPDATE fpo_profiles SET member_count = GREATEST(member_count - 1, 0) WHERE user_id = $1',
        [req.user.id]
    );
    return success(res, null, 'Member removed');
}

async function getListings(req, res) {
    const result = await pool.query(
        'SELECT * FROM listings WHERE fpo_id = $1 AND is_bulk = true ORDER BY created_at DESC',
        [req.user.id]
    );
    return success(res, result.rows);
}

async function createListing(req, res) {
    const validation = validate(createListingSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const data = validation.value;
    const result = await pool.query(
        `INSERT INTO listings (fpo_id, crop, quantity_quintal, price_per_quintal, grade, description, is_bulk, district)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)
         RETURNING *`,
        [req.user.id, data.crop, data.quantity_quintal, data.price_per_quintal, data.grade, data.description || null, data.district || null]
    );
    return success(res, result.rows[0], 'Bulk listing created', 201);
}

async function updateListing(req, res) {
    const { id } = req.params;
    const validation = validate(updateListingSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const owned = await pool.query(
        'SELECT * FROM listings WHERE id = $1 AND fpo_id = $2',
        [id, req.user.id]
    );
    if (owned.rows.length === 0) return error(res, 'Listing not found or unauthorized', 404);

    const fields = []; const params = []; let idx = 1;
    const data = validation.value;
    for (const [key, value] of Object.entries(data)) {
        fields.push(`${key} = $${idx++}`);
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

async function getEligibleSchemes(req, res) {
    const schemeService = require('../services/scheme.service');
    const schemes = await schemeService.getEligibleSchemes('fpo');
    return success(res, schemes);
}

async function applyForScheme(req, res) {
    const { id } = req.params;
    const schemeService = require('../services/scheme.service');
    const result = await schemeService.applyForScheme(req.user.id, id);
    if (result.applied) return success(res, result.application, 'Already applied');
    return success(res, result.application, 'Application submitted', 201);
}

async function getPrices(req, res) {
    const priceService = require('../services/price.service');
    const prices = await priceService.getLatestPrices();
    return success(res, prices);
}

// ─── Verification Pipeline ─────────────────────────────────

async function getVerificationQueue(req, res) {
    const result = await pool.query(
        `SELECT u.id, u.name, u.mobile, u.district, u.state, u.kyc_status, u.created_at as reg_date,
                fp.land_acres, fp.crops, fm.joined_at
         FROM fpo_members fm
         JOIN users u ON fm.farmer_id = u.id
         LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
         WHERE fm.fpo_id = $1 AND u.kyc_status = 'Pending'
         ORDER BY fm.joined_at DESC`,
        [req.user.id]
    );
    return success(res, result.rows);
}

async function getVerificationHistory(req, res) {
    const { farmerId } = req.params;
    const memberCheck = await pool.query(
        'SELECT 1 FROM fpo_members WHERE fpo_id = $1 AND farmer_id = $2',
        [req.user.id, farmerId]
    );
    if (memberCheck.rows.length === 0) return error(res, 'Farmer is not a member of your FPO', 403);

    const farmer = await pool.query(
        "SELECT id, name, mobile, district, state, kyc_status FROM users WHERE id = $1 AND role = 'farmer'",
        [farmerId]
    );
    if (farmer.rows.length === 0) return error(res, 'Farmer not found', 404);

    const audit = await pool.query(
        `SELECT va.id, va.action, va.previous_status, va.new_status, va.reason, va.changed_fields,
                va.reviewer_role, va.created_at,
                u.name as reviewer_name
         FROM verification_audit va
         JOIN users u ON va.reviewed_by = u.id
         WHERE va.farmer_id = $1
         ORDER BY va.created_at DESC`,
        [farmerId]
    );
    return success(res, { farmer: farmer.rows[0], auditLog: audit.rows });
}

async function updateVerification(req, res) {
    const { farmerId } = req.params;
    const validation = validate(fpoVerificationSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { decision, reason } = validation.value;

    const memberCheck = await pool.query(
        'SELECT 1 FROM fpo_members WHERE fpo_id = $1 AND farmer_id = $2',
        [req.user.id, farmerId]
    );
    if (memberCheck.rows.length === 0) return error(res, 'Farmer is not a member of your FPO', 403);

    const farmer = await pool.query(
        "SELECT id, kyc_status FROM users WHERE id = $1 AND role = 'farmer'",
        [farmerId]
    );
    if (farmer.rows.length === 0) return error(res, 'Farmer not found', 404);

    const currentStatus = farmer.rows[0].kyc_status;
    if (currentStatus === 'Verified' || currentStatus === 'Rejected') {
        return error(res, 'This verification has been closed by an Officer and cannot be modified', 409);
    }

    let newStatus;
    if (decision === 'approve') newStatus = 'FPO_Reviewed';
    else newStatus = 'FPO_Rejected';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, farmerId]
        );

        await client.query(
            `INSERT INTO verification_audit (farmer_id, reviewed_by, reviewer_role, action, previous_status, new_status, reason)
             VALUES ($1, $2, 'fpo', $3, $4, $5, $6)`,
            [farmerId, req.user.id, decision, currentStatus, newStatus, reason || null]
        );

        await client.query('COMMIT');
        return success(res, { farmerId, previousStatus: currentStatus, newStatus }, `KYC ${decision === 'approve' ? 'FPO_Reviewed' : 'FPO_Rejected'}`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function getListingVerificationQueue(req, res) {
    const result = await pool.query(
        `SELECT l.*, u.name as farmer_name, u.mobile as farmer_mobile, u.district as farmer_district
         FROM listings l
         JOIN fpo_members fm ON l.farmer_id = fm.farmer_id
         JOIN users u ON l.farmer_id = u.id
         WHERE fm.fpo_id = $1 AND l.status = 'Pending' AND l.is_bulk = false
         ORDER BY l.created_at DESC`,
        [req.user.id]
    );
    return success(res, result.rows);
}

async function updateListingVerification(req, res) {
    const { id } = req.params;
    const validation = validate(fpoListingVerificationSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { decision, reason } = validation.value;

    const listing = await pool.query(
        `SELECT l.* FROM listings l
         JOIN fpo_members fm ON l.farmer_id = fm.farmer_id
         WHERE l.id = $1 AND fm.fpo_id = $2`,
        [id, req.user.id]
    );
    if (listing.rows.length === 0) return error(res, 'Listing not found or not belonging to FPO member', 404);

    const currentStatus = listing.rows[0].status;
    if (currentStatus !== 'Pending') {
        return error(res, 'Listing is not in Pending status', 400);
    }

    const newStatus = decision === 'approve' ? 'FPO_Reviewed' : 'Rejected';

    if (decision === 'approve') {
        const photos = await pool.query(
            "SELECT slot FROM listing_photos WHERE listing_id = $1 AND slot IN ('overview','closeup','quality_detail')",
            [id]
        );
        const present = new Set(photos.rows.map(r => r.slot));
        const missing = ['overview', 'closeup', 'quality_detail'].filter(s => !present.has(s));
        if (missing.length > 0) {
            return error(res, `Cannot approve — missing photos: ${missing.join(', ')}`, 400);
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, id]
        );

        await client.query(
            `INSERT INTO listing_verification_audit (listing_id, reviewed_by, reviewer_role, action, previous_status, new_status, reason)
             VALUES ($1, $2, 'fpo', $3, $4, $5, $6)`,
            [id, req.user.id, decision, currentStatus, newStatus, reason || null]
        );

        await client.query('COMMIT');
        return success(res, { listingId: id, previousStatus: currentStatus, newStatus }, `Listing verification updated to ${newStatus}`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ─── Scheme Application Review ──────────────────────────────

async function getSchemeApplications(req, res) {
    const result = await pool.query(
        `SELECT sa.*, s.name as scheme_name, s.name_hindi, u.name as farmer_name, u.mobile as farmer_mobile
         FROM scheme_applications sa
         JOIN schemes s ON sa.scheme_id = s.id
         JOIN users u ON sa.user_id = u.id
         JOIN fpo_members fm ON fm.farmer_id = u.id
         WHERE fm.fpo_id = $1 AND sa.status = 'Applied'
         ORDER BY sa.created_at DESC`,
        [req.user.id]
    );
    return success(res, result.rows);
}

async function reviewSchemeApplication(req, res) {
    const { id } = req.params;
    const validation = validate(schemeAppReviewSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { decision, reason } = validation.value;
    const application = await pool.query(
        `SELECT sa.* FROM scheme_applications sa
         JOIN fpo_members fm ON fm.farmer_id = sa.user_id
         WHERE sa.id = $1 AND fm.fpo_id = $2`,
        [id, req.user.id]
    );
    if (application.rows.length === 0) return error(res, 'Application not found or unauthorized', 404);
    if (application.rows[0].status !== 'Applied') return error(res, 'Application is not in Applied status', 400);

    const newStatus = decision === 'approve' ? 'Approved' : 'Rejected';
    const result = await pool.query(
        `UPDATE scheme_applications SET status = $1, reviewed_by = $2, reviewer_role = 'fpo', reviewed_at = NOW(), rejection_reason = $3
         WHERE id = $4 RETURNING *`,
        [newStatus, req.user.id, decision === 'reject' ? reason : null, id]
    );
    return success(res, result.rows[0], `Scheme application ${newStatus}`);
}

// ─── History ──────────────────────────────────────────────────

const { historyQuerySchema } = require('../utils/validators');
const historyService = require('../services/history.service');

async function getTradeHistory(req, res) {
    const filters = validate(historyQuerySchema, req.query);
    if (!filters.valid) return error(res, 'Validation failed', 400, filters.errors);
    const { page, limit, from_date, to_date, crop } = filters.value;
    const result = await historyService.getBuyerTradeHistory({
        scope: 'fpo_members', scopeId: req.user.id,
        filters: { from_date, to_date, crop, district: undefined },
        page: parseInt(page), limit: parseInt(limit)
    });
    return paginated(res, result.rows, result.total, result.page, result.limit);
}

async function getLogisticsHistory(req, res) {
    const filters = validate(historyQuerySchema, req.query);
    if (!filters.valid) return error(res, 'Validation failed', 400, filters.errors);
    const { page, limit, from_date, to_date, crop } = filters.value;
    const result = await historyService.getLogisticsTradeHistory({
        scope: 'fpo_members', scopeId: req.user.id,
        filters: { from_date, to_date, crop, district: undefined },
        page: parseInt(page), limit: parseInt(limit)
    });
    return paginated(res, result.rows, result.total, result.page, result.limit);
}

async function getStorageHistory(req, res) {
    const filters = validate(historyQuerySchema, req.query);
    if (!filters.valid) return error(res, 'Validation failed', 400, filters.errors);
    const { page, limit, from_date, to_date, crop } = filters.value;
    const result = await historyService.getStorageTradeHistory({
        scope: 'fpo_members', scopeId: req.user.id,
        filters: { from_date, to_date, crop, district: undefined },
        page: parseInt(page), limit: parseInt(limit)
    });
    return paginated(res, result.rows, result.total, result.page, result.limit);
}

module.exports = {
    getProfile, updateProfile,
    getMembers, addMember, removeMember,
    getListings, createListing, updateListing,
    getEligibleSchemes, applyForScheme, getPrices,
    getVerificationQueue, getVerificationHistory, updateVerification,
    getListingVerificationQueue, updateListingVerification,
    getSchemeApplications, reviewSchemeApplication,
    getTradeHistory, getLogisticsHistory, getStorageHistory
};
