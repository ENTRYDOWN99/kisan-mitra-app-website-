const { validate, updateKycSchema, createSchemeSchema, sendNotificationSchema, officerVerificationSchema, officerListingVerificationSchema, schemeAppReviewSchema } = require('../utils/validators');
const { success, error, paginated } = require('../utils/response.utils');
const pool = require('../db');

async function getDashboard(req, res) {
    const farmerCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'farmer'");
    const kycPending = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'farmer' AND kyc_status = 'Pending'");
    const kycVerified = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'farmer' AND kyc_status = 'Verified'");
    const kycRejected = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'farmer' AND kyc_status = 'Rejected'");
    const activeListings = await pool.query("SELECT COUNT(*) FROM listings WHERE status = 'Active'");
    const totalSchemes = await pool.query("SELECT COUNT(*) FROM schemes WHERE is_active = true");

    return success(res, {
        totalFarmers: parseInt(farmerCount.rows[0].count),
        kycPending: parseInt(kycPending.rows[0].count),
        kycVerified: parseInt(kycVerified.rows[0].count),
        kycRejected: parseInt(kycRejected.rows[0].count),
        activeListings: parseInt(activeListings.rows[0].count),
        activeSchemes: parseInt(totalSchemes.rows[0].count)
    });
}

async function listFarmers(req, res) {
    const { district, kyc_status, crop, page = 1, limit = 20 } = req.query;
    let query = `SELECT u.id, u.name, u.mobile, u.district, u.state, u.kyc_status, u.created_at as reg_date,
                        fp.land_acres, fp.crops
                 FROM users u
                 LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
                 WHERE u.role = 'farmer'`;
    const params = []; let idx = 1;

    if (district) { query += ` AND LOWER(u.district) = LOWER($${idx++})`; params.push(district); }
    if (kyc_status) { query += ` AND u.kyc_status = $${idx++}`; params.push(kyc_status); }
    if (crop) { query += ` AND fp.crops IS NOT NULL AND $${idx++} = ANY(fp.crops)`; params.push(crop); }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) count_query`, params);
    const total = parseInt(countResult.rows[0].count);

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` ORDER BY u.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    return paginated(res, result.rows, total, parseInt(page), parseInt(limit));
}

async function getFarmerDetail(req, res) {
    const { id } = req.params;
    const user = await pool.query(
        `SELECT u.*, fp.aadhaar_last4, fp.land_acres, fp.crops
         FROM users u
         LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
         WHERE u.id = $1 AND u.role = 'farmer'`,
        [id]
    );
    if (user.rows.length === 0) return error(res, 'Farmer not found', 404);

    const listings = await pool.query(
        'SELECT * FROM listings WHERE farmer_id = $1 ORDER BY created_at DESC LIMIT 20',
        [id]
    );
    return success(res, { ...user.rows[0], listings: listings.rows });
}

async function updateKyc(req, res) {
    const { id } = req.params;
    const validation = validate(updateKycSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const result = await pool.query(
        `UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2 AND role = 'farmer' RETURNING *`,
        [validation.value.status, id]
    );
    if (result.rows.length === 0) return error(res, 'Farmer not found', 404);
    return success(res, result.rows[0], `KYC ${validation.value.status}`);
}

async function getAllListings(req, res) {
    const { status, district, page = 1, limit = 20 } = req.query;
    let query = `SELECT l.*, u.name as farmer_name, u.district as farmer_district
                 FROM listings l
                 JOIN users u ON l.farmer_id = u.id WHERE 1=1`;
    const params = []; let idx = 1;

    if (status) { query += ` AND l.status = $${idx++}`; params.push(status); }
    if (district) { query += ` AND LOWER(u.district) = LOWER($${idx++})`; params.push(district); }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) count_query`, params);
    const total = parseInt(countResult.rows[0].count);

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` ORDER BY l.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    return paginated(res, result.rows, total, parseInt(page), parseInt(limit));
}

async function getSchemes(req, res) {
    const schemeService = require('../services/scheme.service');
    const schemes = await schemeService.getAllSchemes(false);
    return success(res, schemes);
}

async function createScheme(req, res) {
    const validation = validate(createSchemeSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const schemeService = require('../services/scheme.service');
    const scheme = await schemeService.createScheme(validation.value, req.user.id);
    return success(res, scheme, 'Scheme created', 201);
}

async function updateScheme(req, res) {
    const { id } = req.params;
    const schemeService = require('../services/scheme.service');
    const scheme = await schemeService.updateScheme(id, req.body);
    if (!scheme) return error(res, 'Scheme not found', 404);
    return success(res, scheme, 'Scheme updated');
}

async function deleteScheme(req, res) {
    const { id } = req.params;
    const schemeService = require('../services/scheme.service');
    const scheme = await schemeService.deleteScheme(id);
    if (!scheme) return error(res, 'Scheme not found', 404);
    return success(res, null, 'Scheme deleted');
}

async function getReports(req, res) {
    const { district } = req.query;
    let districtFilter = '';
    const params = [];
    if (district) { districtFilter = ' WHERE district = $1'; params.push(district); }

    const cropDistribution = await pool.query(`
        SELECT UNNEST(fp.crops) as crop, COUNT(*) as farmer_count
        FROM farmer_profiles fp
        JOIN users u ON fp.user_id = u.id
        ${districtFilter.replace('district', 'u.district')}
        GROUP BY crop ORDER BY farmer_count DESC`, params);

    const kycStats = await pool.query(`
        SELECT kyc_status, COUNT(*) FROM users
        WHERE role = 'farmer' ${districtFilter}
        GROUP BY kyc_status`, params);

    const mandiSummary = await pool.query(`
        SELECT mandi_name, commodity, AVG(price_quintal) as avg_price, MAX(price_quintal) as max_price
        FROM mandi_prices GROUP BY mandi_name, commodity LIMIT 20`);

    return success(res, {
        cropDistribution: cropDistribution.rows,
        kycStats: kycStats.rows,
        mandiSummary: mandiSummary.rows
    });
}

async function sendNotification(req, res) {
    const validation = validate(sendNotificationSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { targetRole, message } = validation.value;
    const notificationService = require('../services/notification.service');
    const result = await notificationService.sendBulkNotification(targetRole, 'Official Notice', message);
    return success(res, result, `Notification sent to ${result.sent} users`);
}

// ─── Verification Pipeline ─────────────────────────────────

async function getVerificationQueue(req, res) {
    const { district } = req.query;
    let query = `
        SELECT u.id, u.name, u.mobile, u.district, u.state, u.kyc_status, u.created_at as reg_date,
               fp.land_acres, fp.crops,
               (SELECT row_to_json(a.*) FROM (
                   SELECT id, action, previous_status, new_status, reason, reviewer_role, created_at
                   FROM verification_audit
                   WHERE farmer_id = u.id AND reviewer_role = 'fpo'
                   ORDER BY created_at DESC LIMIT 1
               ) a) as fpo_latest_action
        FROM users u
        LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
        WHERE u.role = 'farmer' AND u.kyc_status IN ('Pending','FPO_Reviewed','FPO_Rejected')`;
    const params = [];
    let idx = 1;
    if (district) { query += ` AND LOWER(u.district) = LOWER($${idx++})`; params.push(district); }
    query += ` ORDER BY u.updated_at DESC`;

    const result = await pool.query(query, params);
    return success(res, result.rows);
}

async function getVerificationHistory(req, res) {
    const { farmerId } = req.params;
    const farmer = await pool.query(
        "SELECT id, name, mobile, district, state, kyc_status FROM users WHERE id = $1 AND role = 'farmer'",
        [farmerId]
    );
    if (farmer.rows.length === 0) return error(res, 'Farmer not found', 404);

    const audit = await pool.query(
        `SELECT va.*, u.name as reviewer_name, op.employee_id, op.designation
         FROM verification_audit va
         JOIN users u ON va.reviewed_by = u.id
         LEFT JOIN officer_profiles op ON va.reviewed_by = op.user_id
         WHERE va.farmer_id = $1
         ORDER BY va.created_at DESC`,
        [farmerId]
    );
    return success(res, { farmer: farmer.rows[0], auditLog: audit.rows });
}

async function updateVerification(req, res) {
    const { farmerId } = req.params;
    const validation = validate(officerVerificationSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { decision, reason, fieldUpdates } = validation.value;

    const farmer = await pool.query(
        "SELECT * FROM users WHERE id = $1 AND role = 'farmer'",
        [farmerId]
    );
    if (farmer.rows.length === 0) return error(res, 'Farmer not found', 404);

    const currentStatus = farmer.rows[0].kyc_status;
    let newStatus;
    if (decision === 'approve') newStatus = 'Verified';
    else if (decision === 'reject') newStatus = 'Rejected';
    else newStatus = decision === 'override' ? (currentStatus === 'Verified' ? 'Rejected' : 'Verified') : currentStatus;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (fieldUpdates) {
            const updateFields = [];
            const updateParams = [];
            let pIdx = 1;
            if (fieldUpdates.land_acres !== undefined) { updateFields.push(`land_acres = $${pIdx++}`); updateParams.push(fieldUpdates.land_acres); }
            if (fieldUpdates.crops !== undefined) { updateFields.push(`crops = $${pIdx++}`); updateParams.push(fieldUpdates.crops); }
            if (fieldUpdates.district !== undefined) { updateFields.push(`district = $${pIdx++}`); updateParams.push(fieldUpdates.district); }

            if (updateFields.length > 0) {
                if (updateFields.some(f => f.startsWith('land_acres') || f.startsWith('crops'))) {
                    const fpFields = []; const fpParams = []; let fpIdx = 1;
                    if (fieldUpdates.land_acres !== undefined) { fpFields.push(`land_acres = $${fpIdx++}`); fpParams.push(fieldUpdates.land_acres); }
                    if (fieldUpdates.crops !== undefined) { fpFields.push(`crops = $${fpIdx++}`); fpParams.push(fieldUpdates.crops); }
                    if (fpFields.length > 0) {
                        fpParams.push(farmerId);
                        await client.query(
                            `INSERT INTO farmer_profiles (user_id, land_acres, crops)
                             VALUES ($1, $2, $3)
                             ON CONFLICT (user_id)
                             DO UPDATE SET ${fpFields.join(', ')}`,
                            [farmerId, fieldUpdates.land_acres || farmer.rows[0].land_acres, fieldUpdates.crops || farmer.rows[0].crops]
                        );
                    }
                }
                if (fieldUpdates.district !== undefined) {
                    updateParams.push(farmerId);
                    await client.query(
                        `UPDATE users SET district = $1, updated_at = NOW() WHERE id = $2`,
                        [fieldUpdates.district, farmerId]
                    );
                }

                await client.query(
                    `INSERT INTO verification_audit (farmer_id, reviewed_by, reviewer_role, action, previous_status, new_status, reason, changed_fields)
                     VALUES ($1, $2, 'officer', 'update', $3, $3, 'Field update by Officer', $4)`,
                    [farmerId, req.user.id, currentStatus, JSON.stringify(fieldUpdates)]
                );
            }
        }

        await client.query(
            `UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, farmerId]
        );

        await client.query(
            `INSERT INTO verification_audit (farmer_id, reviewed_by, reviewer_role, action, previous_status, new_status, reason)
             VALUES ($1, $2, 'officer', $3, $4, $5, $6)`,
            [farmerId, req.user.id, decision, currentStatus, newStatus, reason || null]
        );

        await client.query('COMMIT');
        return success(res, { farmerId, previousStatus: currentStatus, newStatus }, `KYC ${decision === 'approve' ? 'Verified' : decision === 'reject' ? 'Rejected' : 'Override applied'}`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ─── Listing Verification Pipeline ──────────────────────────

async function getListingVerificationQueue(req, res) {
    const result = await pool.query(
        `SELECT l.*, u.name as farmer_name, u.mobile as farmer_mobile, u.district as farmer_district
         FROM listings l
         JOIN users u ON l.farmer_id = u.id
         WHERE l.status = 'FPO_Reviewed' AND l.is_bulk = false
         ORDER BY l.created_at DESC`,
    );
    return success(res, result.rows);
}

async function updateListingVerification(req, res) {
    const { id } = req.params;
    const validation = validate(officerListingVerificationSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { decision, reason } = validation.value;

    const listing = await pool.query(
        "SELECT * FROM listings WHERE id = $1 AND is_bulk = false",
        [id]
    );
    if (listing.rows.length === 0) return error(res, 'Listing not found', 404);

    const currentStatus = listing.rows[0].status;
    if (currentStatus !== 'FPO_Reviewed') {
        return error(res, 'Listing must be FPO_Reviewed before Officer can act', 400);
    }

    const newStatus = decision === 'approve' ? 'Active' : 'Rejected';

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
             VALUES ($1, $2, 'officer', $3, $4, $5, $6)`,
            [id, req.user.id, decision, currentStatus, newStatus, reason || null]
        );

        await client.query('COMMIT');
        return success(res, { listingId: id, previousStatus: currentStatus, newStatus }, `Listing ${decision === 'approve' ? 'published to market' : 'rejected'}`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ─── Scheme Application Review ──────────────────────────────

async function getSchemeApplications(req, res) {
    const { district, status, page = 1, limit = 20 } = req.query;
    let query = `SELECT sa.*, s.name as scheme_name, s.name_hindi, u.name as farmer_name, u.mobile as farmer_mobile, u.district
                 FROM scheme_applications sa
                 JOIN schemes s ON sa.scheme_id = s.id
                 JOIN users u ON sa.user_id = u.id WHERE 1=1`;
    const params = []; let idx = 1;

    if (district) { query += ` AND LOWER(u.district) = LOWER($${idx++})`; params.push(district); }
    if (status) { query += ` AND sa.status = $${idx++}`; params.push(status); }
    else { query += " AND sa.status = 'Applied'"; }
    query += ` ORDER BY sa.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    return success(res, result.rows);
}

async function reviewSchemeApplication(req, res) {
    const { id } = req.params;
    const validation = validate(schemeAppReviewSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { decision, reason } = validation.value;
    const application = await pool.query(
        'SELECT * FROM scheme_applications WHERE id = $1',
        [id]
    );
    if (application.rows.length === 0) return error(res, 'Application not found', 404);
    if (application.rows[0].status !== 'Applied') return error(res, 'Application is not in Applied status', 400);

    const newStatus = decision === 'approve' ? 'Approved' : 'Rejected';
    const result = await pool.query(
        `UPDATE scheme_applications SET status = $1, reviewed_by = $2, reviewer_role = 'officer', reviewed_at = NOW(), rejection_reason = $3
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
    const { page, limit, from_date, to_date, crop, district } = filters.value;
    const result = await historyService.getBuyerTradeHistory({
        scope: 'all', scopeId: null,
        filters: { from_date, to_date, crop, district },
        page: parseInt(page), limit: parseInt(limit)
    });
    return paginated(res, result.rows, result.total, result.page, result.limit);
}

async function getLogisticsHistory(req, res) {
    const filters = validate(historyQuerySchema, req.query);
    if (!filters.valid) return error(res, 'Validation failed', 400, filters.errors);
    const { page, limit, from_date, to_date, crop, district } = filters.value;
    const result = await historyService.getLogisticsTradeHistory({
        scope: 'all', scopeId: null,
        filters: { from_date, to_date, crop, district },
        page: parseInt(page), limit: parseInt(limit)
    });
    return paginated(res, result.rows, result.total, result.page, result.limit);
}

async function getStorageHistory(req, res) {
    const filters = validate(historyQuerySchema, req.query);
    if (!filters.valid) return error(res, 'Validation failed', 400, filters.errors);
    const { page, limit, from_date, to_date, crop, district } = filters.value;
    const result = await historyService.getStorageTradeHistory({
        scope: 'all', scopeId: null,
        filters: { from_date, to_date, crop, district },
        page: parseInt(page), limit: parseInt(limit)
    });
    return paginated(res, result.rows, result.total, result.page, result.limit);
}

module.exports = {
    getDashboard, listFarmers, getFarmerDetail, updateKyc,
    getAllListings, getSchemes, createScheme, updateScheme, deleteScheme,
    getReports, sendNotification,
    getVerificationQueue, getVerificationHistory, updateVerification,
    getListingVerificationQueue, updateListingVerification,
    getSchemeApplications, reviewSchemeApplication,
    getTradeHistory, getLogisticsHistory, getStorageHistory
};
