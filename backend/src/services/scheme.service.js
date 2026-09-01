const pool = require('../db');

async function getAllSchemes(activeOnly = true) {
    let query = 'SELECT * FROM schemes';
    if (activeOnly) query += ' WHERE is_active = true';
    query += ' ORDER BY updated_at DESC';
    const result = await pool.query(query);
    return result.rows;
}

async function getSchemeById(id) {
    const result = await pool.query('SELECT * FROM schemes WHERE id = $1', [id]);
    return result.rows[0] || null;
}

async function createScheme(data, createdBy) {
    const result = await pool.query(
        `INSERT INTO schemes (name, department, benefit_description, eligible_roles, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [data.name, data.department || null, data.benefit_description, data.eligible_roles, createdBy]
    );
    return result.rows[0];
}

async function updateScheme(id, data) {
    const fields = [];
    const params = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); params.push(data.name); }
    if (data.department !== undefined) { fields.push(`department = $${idx++}`); params.push(data.department); }
    if (data.benefit_description !== undefined) { fields.push(`benefit_description = $${idx++}`); params.push(data.benefit_description); }
    if (data.eligible_roles !== undefined) { fields.push(`eligible_roles = $${idx++}`); params.push(data.eligible_roles); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); params.push(data.is_active); }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
        `UPDATE schemes SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    );
    return result.rows[0] || null;
}

async function deleteScheme(id) {
    const result = await pool.query(
        'DELETE FROM schemes WHERE id = $1 RETURNING *',
        [id]
    );
    return result.rows[0] || null;
}

async function getEligibleSchemes(role) {
    const result = await pool.query(
        `SELECT * FROM schemes WHERE is_active = true AND $1 = ANY(eligible_roles)
         ORDER BY updated_at DESC`,
        [role]
    );
    return result.rows;
}

async function applyForScheme(userId, schemeId) {
    const existing = await pool.query(
        'SELECT * FROM scheme_applications WHERE user_id = $1 AND scheme_id = $2',
        [userId, schemeId]
    );
    if (existing.rows.length > 0) {
        return { applied: true, application: existing.rows[0] };
    }
    const result = await pool.query(
        `INSERT INTO scheme_applications (user_id, scheme_id, status)
         VALUES ($1, $2, 'Applied')
         RETURNING *`,
        [userId, schemeId]
    );
    return { applied: false, application: result.rows[0] };
}

async function getUserApplications(userId) {
    const result = await pool.query(
        `SELECT sa.*, s.name as scheme_name, s.department, s.benefit_description
         FROM scheme_applications sa
         JOIN schemes s ON sa.scheme_id = s.id
         WHERE sa.user_id = $1
         ORDER BY sa.created_at DESC`,
        [userId]
    );
    return result.rows;
}

module.exports = {
    getAllSchemes,
    getSchemeById,
    createScheme,
    updateScheme,
    deleteScheme,
    getEligibleSchemes,
    applyForScheme,
    getUserApplications
};
