const { Router } = require('express');
const router = Router();
const { sendOtpHandler, verifyOtpHandler, refreshHandler, logoutHandler } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { otpLimiter, otpVerifyLimiter } = require('../middleware/rateLimit.middleware');

router.post('/send-otp', otpLimiter, sendOtpHandler);
router.post('/verify-otp', otpVerifyLimiter, verifyOtpHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', authenticate, logoutHandler);

module.exports = router;
