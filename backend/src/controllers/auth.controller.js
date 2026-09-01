const { validate, sendOtpSchema, verifyOtpSchema, refreshSchema } = require('../utils/validators');
const { success, error } = require('../utils/response.utils');
const { generateOtp, sendOtpViaSms, storeOtpSession, verifyOtp, createOrFindUser } = require('../services/otp.service');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt.utils');

async function sendOtpHandler(req, res) {
    const validation = validate(sendOtpSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { mobile, role } = validation.value;
    const otp = generateOtp();
    await storeOtpSession(mobile, otp, role);
    await sendOtpViaSms(mobile, otp);

    return success(res, { expiresIn: 600 }, 'OTP sent successfully');
}

async function verifyOtpHandler(req, res) {
    const validation = validate(verifyOtpSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { mobile, otp, role } = validation.value;
    const result = await verifyOtp(mobile, otp, role);
    if (!result.valid) return error(res, result.reason, 401);

    const user = await createOrFindUser(mobile, role);
    const tokens = generateTokens(user);

    return success(res, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
            id: user.id,
            mobile: user.mobile,
            name: user.name,
            role: user.role,
            district: user.district,
            state: user.state,
            kyc_status: user.kyc_status
        }
    }, 'Login successful');
}

async function refreshHandler(req, res) {
    const validation = validate(refreshSchema, req.body);
    if (!validation.valid) return error(res, 'Validation failed', 400, validation.errors);

    const { refreshToken } = validation.value;
    try {
        const decoded = verifyRefreshToken(refreshToken);
        const user = { id: decoded.id, mobile: decoded.mobile, role: decoded.role };
        const tokens = generateTokens(user);
        return success(res, { accessToken: tokens.accessToken }, 'Token refreshed');
    } catch (err) {
        return error(res, 'Invalid or expired refresh token', 401);
    }
}

async function logoutHandler(req, res) {
    return success(res, null, 'Logged out successfully');
}

module.exports = { sendOtpHandler, verifyOtpHandler, refreshHandler, logoutHandler };
