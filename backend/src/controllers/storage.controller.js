const { validate, createStorageFacilitySchema, createStorageRequestSchema, storageVerifySchema } = require('../utils/validators');
const { success, error } = require('../utils/response.utils');
const pool = require('../db');

// ─── FPO: Facility CRUD ──────────────────────────────────────

async function createFacility(req, res) {
    const validation = validate(createStorageFacilitySchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const data = validation.value;
    const result = await pool.query(
        `INSERT INTO storage_facilities (fpo_id, name, district, state, capacity_quintal, available_capacity_quintal, rate_per_quintal_month, accepted_crops)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [req.user.id, data.name, data.district || null, data.state || null,
         data.capacity_quintal, data.capacity_quintal, data.rate_per_quintal_month, data.accepted_crops || null]
    );
    return success(res, result.rows[0], 'Storage facility created', 201);
}

async function updateFacility(req, res) {
    const { id } = req.params;
    const validation = validate(createStorageFacilitySchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const owned = await pool.query(
        'SELECT * FROM storage_facilities WHERE id = $1 AND fpo_id = $2',
        [id, req.user.id]
    );
    if (owned.rows.length === 0) return error(res, 'Facility not found or unauthorized', 404);

    const data = validation.value;
    const result = await pool.query(
        `UPDATE storage_facilities SET name = $1, district = $2, state = $3, capacity_quintal = $4,
                rate_per_quintal_month = $5, accepted_crops = $6, updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [data.name, data.district || null, data.state || null, data.capacity_quintal,
         data.rate_per_quintal_month, data.accepted_crops || null, id]
    );
    return success(res, result.rows[0], 'Facility updated');
}

async function getMyFacilities(req, res) {
    const result = await pool.query(
        'SELECT * FROM storage_facilities WHERE fpo_id = $1 ORDER BY created_at DESC',
        [req.user.id]
    );
    return success(res, result.rows);
}

async function deleteFacility(req, res) {
    const { id } = req.params;
    const result = await pool.query(
        'DELETE FROM storage_facilities WHERE id = $1 AND fpo_id = $2 RETURNING *',
        [id, req.user.id]
    );
    if (result.rows.length === 0) return error(res, 'Facility not found or unauthorized', 404);
    return success(res, null, 'Facility deleted');
}

// ─── FPO: Incoming Storage Requests ──────────────────────────

async function getIncomingRequests(req, res) {
    const result = await pool.query(
        `SELECT sr.*, u.name as farmer_name, u.mobile as farmer_mobile, sf.name as facility_name
         FROM storage_requests sr
         JOIN storage_facilities sf ON sr.facility_id = sf.id
         JOIN users u ON sr.farmer_id = u.id
         WHERE sf.fpo_id = $1
         ORDER BY sr.requested_at DESC`,
        [req.user.id]
    );
    return success(res, result.rows);
}

async function verifyStorageRequest(req, res) {
    const { id } = req.params;
    const validation = validate(storageVerifySchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { decision, reason } = validation.value;

    const request = await pool.query(
        `SELECT sr.*, sf.fpo_id FROM storage_requests sr
         JOIN storage_facilities sf ON sr.facility_id = sf.id
         WHERE sr.id = $1 AND sf.fpo_id = $2`,
        [id, req.user.id]
    );
    if (request.rows.length === 0) return error(res, 'Request not found or unauthorized', 404);
    if (request.rows[0].status !== 'Requested') return error(res, 'Request is not in Requested status', 400);

    const newStatus = decision === 'approve' ? 'FPO_Verified' : 'Rejected';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE storage_requests SET status = $1, verified_by = $2, verified_at = NOW() WHERE id = $3`,
            [newStatus, req.user.id, id]
        );

        if (decision === 'approve') {
            const capResult = await client.query(
                `UPDATE storage_facilities SET available_capacity_quintal = available_capacity_quintal - $1
                 WHERE id = $2 AND available_capacity_quintal >= $1`,
                [request.rows[0].quantity_quintal, request.rows[0].facility_id]
            );
            if (capResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return error(res, 'Insufficient available capacity — allocation would exceed remaining space', 409);
            }
        }

        await client.query('COMMIT');
        return success(res, { requestId: id, newStatus }, `Storage request ${decision === 'approve' ? 'verified' : 'rejected'}`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ─── Farmer: Browse & Request Storage ────────────────────────

async function browseFacilities(req, res) {
    const { district, crop, page = 1, limit = 20 } = req.query;
    let query = `SELECT * FROM storage_facilities WHERE is_active = true`;
    const params = []; let idx = 1;

    if (district) { query += ` AND LOWER(district) = LOWER($${idx++})`; params.push(district); }
    if (crop) { query += ` AND $${idx++} = ANY(accepted_crops)`; params.push(crop); }
    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    return success(res, result.rows);
}

async function createStorageRequest(req, res) {
    const validation = validate(createStorageRequestSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const data = validation.value;
    const facility = await pool.query(
        'SELECT * FROM storage_facilities WHERE id = $1 AND is_active = true',
        [data.facility_id]
    );
    if (facility.rows.length === 0) return error(res, 'Facility not found or inactive', 404);
    if (facility.rows[0].available_capacity_quintal < data.quantity_quintal) {
        return error(res, 'Insufficient available capacity', 400);
    }

    const result = await pool.query(
        `INSERT INTO storage_requests (farmer_id, facility_id, crop, quantity_quintal, duration_months)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.user.id, data.facility_id, data.crop, data.quantity_quintal, data.duration_months]
    );
    return success(res, result.rows[0], 'Storage request submitted', 201);
}

async function getMyStorageRequests(req, res) {
    const result = await pool.query(
        `SELECT sr.*, sf.name as facility_name, sf.district, sf.rate_per_quintal_month
         FROM storage_requests sr
         JOIN storage_facilities sf ON sr.facility_id = sf.id
         WHERE sr.farmer_id = $1
         ORDER BY sr.requested_at DESC`,
        [req.user.id]
    );
    return success(res, result.rows);
}

// ─── Officer: Storage Oversight ──────────────────────────────

async function getAllFacilities(req, res) {
    const { district, page = 1, limit = 20 } = req.query;
    let query = `SELECT sf.*, u.name as fpo_name FROM storage_facilities sf JOIN users u ON sf.fpo_id = u.id WHERE 1=1`;
    const params = []; let idx = 1;

    if (district) { query += ` AND LOWER(sf.district) = LOWER($${idx++})`; params.push(district); }
    query += ` ORDER BY sf.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    return success(res, result.rows);
}

async function getAllStorageRequests(req, res) {
    const { district, status, page = 1, limit = 20 } = req.query;
    let query = `SELECT sr.*, sf.name as facility_name, sf.district, u.name as farmer_name, u.mobile as farmer_mobile
                 FROM storage_requests sr
                 JOIN storage_facilities sf ON sr.facility_id = sf.id
                 JOIN users u ON sr.farmer_id = u.id WHERE 1=1`;
    const params = []; let idx = 1;

    if (district) { query += ` AND LOWER(sf.district) = LOWER($${idx++})`; params.push(district); }
    if (status) { query += ` AND sr.status = $${idx++}`; params.push(status); }
    query += ` ORDER BY sr.requested_at DESC LIMIT $${idx++} OFFSET $${idx++}`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    return success(res, result.rows);
}

async function flagFacility(req, res) {
    const { id } = req.params;
    const result = await pool.query(
        `UPDATE storage_facilities SET is_active = false WHERE id = $1 RETURNING *`,
        [id]
    );
    if (result.rows.length === 0) return error(res, 'Facility not found', 404);
    return success(res, result.rows[0], 'Facility flagged');
}

module.exports = {
    createFacility, updateFacility, getMyFacilities, deleteFacility,
    getIncomingRequests, verifyStorageRequest,
    browseFacilities, createStorageRequest, getMyStorageRequests,
    getAllFacilities, getAllStorageRequests, flagFacility
};
