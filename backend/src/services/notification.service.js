const pool = require('../db');

async function sendNotification(userId, title, message, type = 'info') {
    const result = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, title, message, type]
    );
    return result.rows[0];
}

async function sendBulkNotification(targetRole, title, message, type = 'info') {
    let query = 'SELECT id FROM users WHERE is_active = true';
    const params = [];
    if (targetRole !== 'all') {
        query += ' AND role = $1';
        params.push(targetRole);
    }
    const users = await pool.query(query, params);

    const notifications = users.rows.map(u => {
        return pool.query(
            `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
            [u.id, title, message, type]
        );
    });
    await Promise.all(notifications);
    return { sent: users.rows.length };
}

async function getUserNotifications(userId, limit = 20) {
    const result = await pool.query(
        `SELECT * FROM notifications WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
    );
    return result.rows;
}

async function markAsRead(notificationId, userId) {
    const result = await pool.query(
        `UPDATE notifications SET is_read = true
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [notificationId, userId]
    );
    return result.rows[0] || null;
}

async function getUnreadCount(userId) {
    const result = await pool.query(
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
        [userId]
    );
    return parseInt(result.rows[0].count);
}

module.exports = {
    sendNotification,
    sendBulkNotification,
    getUserNotifications,
    markAsRead,
    getUnreadCount
};
