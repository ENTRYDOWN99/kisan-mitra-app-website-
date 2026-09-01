const pool = require('../db');

async function getPrices(filters = {}) {
    let query = 'SELECT * FROM mandi_prices WHERE 1=1';
    const params = [];
    let idx = 1;

    if (filters.commodity) {
        query += ` AND LOWER(commodity) LIKE LOWER($${idx})`;
        params.push(`%${filters.commodity}%`);
        idx++;
    }
    if (filters.state) {
        query += ` AND LOWER(state) = LOWER($${idx})`;
        params.push(filters.state);
        idx++;
    }
    if (filters.mandi) {
        query += ` AND LOWER(mandi_name) LIKE LOWER($${idx})`;
        params.push(`%${filters.mandi}%`);
        idx++;
    }

    query += ' ORDER BY recorded_at DESC LIMIT 100';
    const result = await pool.query(query, params);
    return result.rows;
}

async function getLatestPrices() {
    const result = await pool.query(`
        SELECT DISTINCT ON (commodity, mandi_name) *
        FROM mandi_prices
        ORDER BY commodity, mandi_name, recorded_at DESC
    `);
    return result.rows;
}

async function upsertPrice(record) {
    const result = await pool.query(
        `INSERT INTO mandi_prices (mandi_name, state, commodity, price_quintal, msp_quintal)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [record.mandi_name, record.state, record.commodity, record.price_quintal, record.msp_quintal || 0]
    );
    return result.rows[0];
}

module.exports = { getPrices, getLatestPrices, upsertPrice };
