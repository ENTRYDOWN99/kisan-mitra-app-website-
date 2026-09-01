const { verifyAccessToken } = require('../utils/jwt.utils');
const { error } = require('../utils/response.utils');

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return error(res, 'Access token required', 401);
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return error(res, 'Access token expired', 401);
        }
        return error(res, 'Invalid access token', 401);
    }
}

module.exports = { authenticate };
