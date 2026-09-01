const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many OTP requests. Try again after 1 hour.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.body.mobile || req.ip
});

const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many verification attempts. Try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { otpLimiter, otpVerifyLimiter, apiLimiter };
