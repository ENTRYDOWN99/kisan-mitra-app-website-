const { error } = require('../utils/response.utils');

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return error(res, 'Unauthorized — no authenticated user', 401);
        }
        if (!allowedRoles.includes(req.user.role)) {
            return error(res, `Access denied. Requires role: ${allowedRoles.join(' or ')}`, 403);
        }
        next();
    };
}

module.exports = { requireRole };
