const { validate, createBidSchema, updateProfileSchema } = require('../utils/validators');
const { success, error } = require('../utils/response.utils');
const pool = require('../db');

async function getProfile(req, res) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return error(res, 'User not found', 404);
    const profile = await pool.query('SELECT * FROM buyer_profiles WHERE user_id = $1', [req.user.id]);
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

    if (data.company_name || data.gst_number || data.category) {
        await pool.query(
            `INSERT INTO buyer_profiles (user_id, company_name, gst_number, category)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id)
             DO UPDATE SET company_name = COALESCE($2, buyer_profiles.company_name),
                           gst_number = COALESCE($3, buyer_profiles.gst_number),
                           category = COALESCE($4, buyer_profiles.category)`,
            [req.user.id, data.company_name || null, data.gst_number || null, data.category || null]
        );
    }

    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    return success(res, user.rows[0], 'Profile updated');
}

async function getMarketListings(req, res) {
    const { crop, district, grade, sort } = req.query;
    let query = `SELECT l.id, l.crop, l.quantity_quintal, l.price_per_quintal, l.grade, l.description, l.district, l.created_at,
                        (u.kyc_status = 'Verified') AS farmer_verified
                 FROM listings l
                 JOIN users u ON l.farmer_id = u.id
                 WHERE l.status = 'Active' AND l.is_bulk = false`;
    const params = []; let idx = 1;

    if (crop) { query += ` AND LOWER(l.crop) LIKE LOWER($${idx++})`; params.push(`%${crop}%`); }
    if (district) { query += ` AND LOWER(l.district) = LOWER($${idx++})`; params.push(district); }
    if (grade) { query += ` AND l.grade = $${idx++}`; params.push(grade); }
    query += ' ORDER BY l.created_at DESC LIMIT 50';

    const result = await pool.query(query, params);
    return success(res, result.rows);
}

async function createBid(req, res) {
    const validation = validate(createBidSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { listing_id, bid_price, quantity } = validation.value;
    const listing = await pool.query('SELECT * FROM listings WHERE id = $1 AND status = $2', [listing_id, 'Active']);
    if (listing.rows.length === 0) return error(res, 'Listing not found or not active', 404);
    if (listing.rows[0].farmer_id === req.user.id) {
        return error(res, 'Cannot bid on your own listing', 400);
    }

    const existing = await pool.query(
        'SELECT * FROM bids WHERE listing_id = $1 AND buyer_id = $2 AND status = $3',
        [listing_id, req.user.id, 'Pending']
    );
    if (existing.rows.length > 0) return error(res, 'You already have a pending bid on this listing', 400);

    const result = await pool.query(
        `INSERT INTO bids (listing_id, buyer_id, bid_price, quantity)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [listing_id, req.user.id, bid_price, quantity || null]
    );
    return success(res, result.rows[0], 'Bid placed', 201);
}

async function getBids(req, res) {
    const result = await pool.query(
        `SELECT b.*, l.crop, l.quantity_quintal, l.price_per_quintal
         FROM bids b
         JOIN listings l ON b.listing_id = l.id
         WHERE b.buyer_id = $1
         ORDER BY b.created_at DESC`,
        [req.user.id]
    );
    return success(res, result.rows);
}

async function updateBid(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Withdrawn'].includes(status)) return error(res, 'Invalid status update', 400);

    const result = await pool.query(
        'UPDATE bids SET status = $1 WHERE id = $2 AND buyer_id = $3 RETURNING *',
        [status, id, req.user.id]
    );
    if (result.rows.length === 0) return error(res, 'Bid not found or unauthorized', 404);
    return success(res, result.rows[0], 'Bid updated');
}

async function getPrices(req, res) {
    const priceService = require('../services/price.service');
    const prices = await priceService.getLatestPrices();
    return success(res, prices);
}

module.exports = { getProfile, updateProfile, getMarketListings, createBid, getBids, updateBid, getPrices };
