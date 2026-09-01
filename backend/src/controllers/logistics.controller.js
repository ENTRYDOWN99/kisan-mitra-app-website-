const { validate, createShipmentSchema, updateShipmentStatusSchema, trackingPingSchema, markPaymentSchema, updateLogisticsProfileSchema } = require('../utils/validators');
const { success, error } = require('../utils/response.utils');
const pool = require('../db');

// ─── Profile ─────────────────────────────────────────────────

async function getProfile(req, res) {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (user.rows.length === 0) return error(res, 'User not found', 404);
    const profile = await pool.query('SELECT * FROM logistics_profiles WHERE user_id = $1', [req.user.id]);
    return success(res, { ...user.rows[0], profile: profile.rows[0] || null });
}

async function updateProfile(req, res) {
    const validation = validate(updateLogisticsProfileSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const data = validation.value;
    await pool.query(
        `INSERT INTO logistics_profiles (user_id, company_name, gst_number, license_number, service_area, fleet_size)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id)
         DO UPDATE SET company_name = COALESCE($2, logistics_profiles.company_name),
                       gst_number = COALESCE($3, logistics_profiles.gst_number),
                       license_number = COALESCE($4, logistics_profiles.license_number),
                       service_area = COALESCE($5, logistics_profiles.service_area),
                       fleet_size = COALESCE($6, logistics_profiles.fleet_size)`,
        [req.user.id, data.company_name || null, data.gst_number || null,
         data.license_number || null, data.service_area || null, data.fleet_size ?? null]
    );

    const profile = await pool.query('SELECT * FROM logistics_profiles WHERE user_id = $1', [req.user.id]);
    return success(res, profile.rows[0], 'Profile updated');
}

// ─── Orders (available for booking) ──────────────────────────

async function getAvailableOrders(req, res) {
    const result = await pool.query(
        `SELECT b.*, l.crop, l.quantity_quintal, l.district, u.name as farmer_name,
                ub.name as buyer_name, ub.mobile as buyer_mobile
         FROM bids b
         JOIN listings l ON b.listing_id = l.id
         JOIN users u ON l.farmer_id = u.id
         JOIN users ub ON b.buyer_id = ub.id
         WHERE b.status = 'Accepted'`,
    );
    return success(res, result.rows);
}

// ─── Shipments ───────────────────────────────────────────────

async function createShipment(req, res) {
    const validation = validate(createShipmentSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const data = validation.value;
    const result = await pool.query(
        `INSERT INTO shipments (logistics_id, purpose, bid_id, storage_request_id, pickup_location, drop_location, crop, quantity_quintal, vehicle_type, scheduled_pickup_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [req.user.id, data.purpose, data.bid_id || null, data.storage_request_id || null,
         data.pickup_location, data.drop_location,
         data.crop || null, data.quantity_quintal || null, data.vehicle_type || null,
         data.scheduled_pickup_at || null]
    );
    return success(res, result.rows[0], 'Shipment booked', 201);
}

async function updateShipmentStatus(req, res) {
    const { id } = req.params;
    const validation = validate(updateShipmentStatusSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { status: newStatus } = validation.value;
    const owned = await pool.query(
        'SELECT * FROM shipments WHERE id = $1 AND logistics_id = $2',
        [id, req.user.id]
    );
    if (owned.rows.length === 0) return error(res, 'Shipment not found or unauthorized', 404);

    const result = await pool.query(
        `UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [newStatus, id]
    );
    return success(res, result.rows[0], `Shipment status updated to ${newStatus}`);
}

async function getMyShipments(req, res) {
    const { status, page = 1, limit = 20 } = req.query;
    let query = `SELECT * FROM shipments WHERE logistics_id = $1`;
    const params = [req.user.id]; let idx = 2;

    if (status) { query += ` AND status = $${idx++}`; params.push(status); }
    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    return success(res, result.rows);
}

// ─── Tracking ────────────────────────────────────────────────

async function pushTrackingPing(req, res) {
    const { id } = req.params;
    const validation = validate(trackingPingSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const owned = await pool.query(
        'SELECT id FROM shipments WHERE id = $1 AND logistics_id = $2',
        [id, req.user.id]
    );
    if (owned.rows.length === 0) return error(res, 'Shipment not found or unauthorized', 404);

    const { latitude, longitude } = validation.value;
    const result = await pool.query(
        `INSERT INTO shipment_tracking_pings (shipment_id, latitude, longitude) VALUES ($1, $2, $3) RETURNING *`,
        [id, latitude, longitude]
    );
    return success(res, result.rows[0], 'Tracking ping recorded', 201);
}

async function getTrackingHistory(req, res) {
    const { id } = req.params;
    const result = await pool.query(
        `SELECT * FROM shipment_tracking_pings WHERE shipment_id = $1 ORDER BY recorded_at DESC`,
        [id]
    );
    return success(res, result.rows);
}

// ─── Payments ────────────────────────────────────────────────

async function getPayments(req, res) {
    const result = await pool.query(
        `SELECT sp.*, s.pickup_location, s.drop_location, s.crop
         FROM shipment_payments sp
         JOIN shipments s ON sp.shipment_id = s.id
         WHERE s.logistics_id = $1
         ORDER BY sp.created_at DESC`,
        [req.user.id]
    );
    return success(res, result.rows);
}

async function markPayment(req, res) {
    const validation = validate(markPaymentSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const data = validation.value;
    const result = await pool.query(
        `INSERT INTO shipment_payments (shipment_id, amount, status, method, transaction_ref)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.params.id, data.amount, data.status, data.method || null, data.transaction_ref || null]
    );
    return success(res, result.rows[0], 'Payment recorded', 201);
}

module.exports = {
    getProfile, updateProfile,
    getAvailableOrders,
    createShipment, updateShipmentStatus, getMyShipments,
    pushTrackingPing, getTrackingHistory,
    getPayments, markPayment
};
