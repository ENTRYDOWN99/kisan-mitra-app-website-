const pool = require('../db');

/**
 * Build WHERE clause and params for role scoping.
 * @param {{ scope, scopeId, filters }} opts
 * @param {string} prefix - table alias for users (e.g. 'farmer')
 * @param {number} startIdx - starting parameter index
 * @returns {{ clause: string, params: array, idx: number }}
 */
function buildScopeClause({ scope, scopeId, filters }, alias, startIdx = 1) {
    let clause = '';
    const params = [];
    let idx = startIdx;

    if (scope === 'fpo_members') {
        clause += ` AND ${alias}.id IN (SELECT fm.farmer_id FROM fpo_members fm WHERE fm.fpo_id = $${idx++})`;
        params.push(scopeId);
    }
    if (filters.district) {
        clause += ` AND LOWER(${alias}.district) = LOWER($${idx++})`;
        params.push(filters.district);
    }
    if (filters.from_date) {
        clause += ` AND b.created_at >= $${idx++}`;
        params.push(filters.from_date);
    }
    if (filters.to_date) {
        clause += ` AND b.created_at <= $${idx++}`;
        params.push(filters.to_date);
    }
    if (filters.crop) {
        clause += ` AND LOWER(l.crop) LIKE LOWER($${idx++})`;
        params.push(`%${filters.crop}%`);
    }

    return { clause, params, idx };
}

// ─── Slide 1: Farmer ↔ Buyer (accepted bids) ───────────────────

async function getBuyerTradeHistory({ scope, scopeId, filters, page, limit }) {
    const { clause, params, idx } = buildScopeClause({ scope, scopeId, filters }, 'farmer');

    const baseQuery = `
        FROM bids b
        JOIN listings l ON b.listing_id = l.id
        JOIN users buyer ON b.buyer_id = buyer.id
        JOIN users farmer ON l.farmer_id = farmer.id
        WHERE b.status IN ('Accepted')
    `;

    const countResult = await pool.query(`SELECT COUNT(*) ${baseQuery}${clause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * limit;
    const dataQuery = `
        SELECT l.id AS listing_id, l.crop, l.quantity_quintal,
               farmer.name AS farmer_name, farmer.district AS farmer_district,
               buyer.name AS buyer_name, b.bid_price, b.status AS bid_status,
               l.price_per_quintal AS listing_price,
               b.created_at AS traded_at
        ${baseQuery}${clause}
        ORDER BY b.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const result = await pool.query(dataQuery, params);
    return { rows: result.rows, total, page, limit };
}

// ─── Slide 2: Farmer ↔ Logistics (buyer_delivery shipments) ────

async function getLogisticsTradeHistory({ scope, scopeId, filters, page, limit }) {
    const cParams = [];
    let cIdx = 1;
    let cClause = '';

    if (scope === 'fpo_members') {
        cClause += ` AND farmer.id IN (SELECT fm.farmer_id FROM fpo_members fm WHERE fm.fpo_id = $${cIdx++})`;
        cParams.push(scopeId);
    }
    if (filters.district) {
        cClause += ` AND LOWER(farmer.district) = LOWER($${cIdx++})`;
        cParams.push(filters.district);
    }
    if (filters.from_date) {
        cClause += ` AND s.scheduled_pickup_at >= $${cIdx++}`;
        cParams.push(filters.from_date);
    }
    if (filters.to_date) {
        cClause += ` AND s.scheduled_pickup_at <= $${cIdx++}`;
        cParams.push(filters.to_date);
    }
    if (filters.crop) {
        cClause += ` AND (LOWER(l.crop) LIKE LOWER($${cIdx++}) OR LOWER(s.crop) LIKE LOWER($${cIdx++}))`;
        cParams.push(`%${filters.crop}%`, `%${filters.crop}%`);
    }

    const base = `
        FROM shipments s
        JOIN logistics_profiles lp ON s.logistics_id = lp.user_id
        JOIN users farmer ON s.farmer_id = farmer.id
        LEFT JOIN bids b ON s.bid_id = b.id
        LEFT JOIN listings l ON b.listing_id = l.id
        WHERE s.purpose = 'buyer_delivery'
    `;

    const countResult = await pool.query(`SELECT COUNT(*) ${base}${cClause}`, cParams);
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * limit;
    cParams.push(limit, offset);

    const result = await pool.query(`
        SELECT s.id AS shipment_id, farmer.name AS farmer_name,
               COALESCE(l.crop, s.crop) AS crop,
               COALESCE(s.quantity_quintal, l.quantity_quintal) AS quantity_quintal,
               lp.company_name AS logistics_company,
               s.pickup_location, s.drop_location,
               s.status, s.scheduled_pickup_at, s.delivered_at
        ${base}${cClause}
        ORDER BY s.created_at DESC
        LIMIT $${cIdx++} OFFSET $${cIdx}
    `, cParams);

    return { rows: result.rows, total, page, limit };
}

// ─── Slide 3: Farmer ↔ Storage (storage_delivery shipments) ────

async function getStorageTradeHistory({ scope, scopeId, filters, page, limit }) {
    const cParams = [];
    let cIdx = 1;
    let cClause = '';

    if (scope === 'fpo_members') {
        cClause += ` AND farmer.id IN (SELECT fm.farmer_id FROM fpo_members fm WHERE fm.fpo_id = $${cIdx++})`;
        cParams.push(scopeId);
    }
    if (filters.district) {
        cClause += ` AND LOWER(farmer.district) = LOWER($${cIdx++})`;
        cParams.push(filters.district);
    }
    if (filters.from_date) {
        cClause += ` AND s.scheduled_pickup_at >= $${cIdx++}`;
        cParams.push(filters.from_date);
    }
    if (filters.to_date) {
        cClause += ` AND s.scheduled_pickup_at <= $${cIdx++}`;
        cParams.push(filters.to_date);
    }
    if (filters.crop) {
        cClause += ` AND LOWER(sf.accepted_crops::text) LIKE LOWER($${cIdx++})`;
        cParams.push(`%${filters.crop}%`);
    }

    const base = `
        FROM shipments s
        JOIN logistics_profiles lp ON s.logistics_id = lp.user_id
        JOIN users farmer ON s.farmer_id = farmer.id
        JOIN storage_requests sr ON s.storage_request_id = sr.id
        JOIN storage_facilities sf ON sr.facility_id = sf.id
        WHERE s.purpose = 'storage_delivery'
    `;

    const countResult = await pool.query(`SELECT COUNT(*) ${base}${cClause}`, cParams);
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * limit;
    cParams.push(limit, offset);

    const result = await pool.query(`
        SELECT s.id AS shipment_id, farmer.name AS farmer_name,
               sr.crop, sr.quantity_quintal,
               lp.company_name AS logistics_company,
               sf.name AS facility_name, sf.district AS facility_district,
               s.pickup_location, s.drop_location,
               s.status, s.scheduled_pickup_at, s.delivered_at
        ${base}${cClause}
        ORDER BY s.created_at DESC
        LIMIT $${cIdx++} OFFSET $${cIdx}
    `, cParams);

    return { rows: result.rows, total, page, limit };
}

module.exports = {
    getBuyerTradeHistory,
    getLogisticsTradeHistory,
    getStorageTradeHistory
};
