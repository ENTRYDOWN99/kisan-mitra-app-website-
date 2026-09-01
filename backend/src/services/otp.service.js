const bcrypt = require('bcrypt');

const pool = require('../db');
const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;

// Per-mobile lockout across sessions (5 consecutive wrong OTPs → 15 min block)
const failedLoginStore = new Map();
const FAILED_LOGIN_LIMIT = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

function checkMobileLockout(mobile) {
    const entry = failedLoginStore.get(mobile);
    if (!entry) return null;
    if (Date.now() > entry.lockoutUntil) {
        failedLoginStore.delete(mobile);
        return null;
    }
    return Math.ceil((entry.lockoutUntil - Date.now()) / 1000);
}

function recordFailedLogin(mobile) {
    const now = Date.now();
    let entry = failedLoginStore.get(mobile);
    if (!entry || now > entry.windowStart + FAILED_LOGIN_WINDOW_MS) {
        entry = { count: 1, windowStart: now, lockoutUntil: null };
    } else {
        entry.count++;
    }
    if (entry.count >= FAILED_LOGIN_LIMIT) {
        entry.lockoutUntil = now + FAILED_LOGIN_WINDOW_MS;
    }
    failedLoginStore.set(mobile, entry);
}

function clearFailedLogin(mobile) {
    failedLoginStore.delete(mobile);
}

function generateOtp() {
    const bypass = process.env.OTP_BYPASS;
    if (bypass && process.env.NODE_ENV === 'development') {
        return bypass;
    }
    return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendOtpViaSms(mobile, otp) {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] OTP for ${mobile}: ${otp}`);
        return true;
    }
    try {
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
            body: `Your KISAN MITRA OTP is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: `+91${mobile}`
        });
        return true;
    } catch (err) {
        console.error('Twilio error:', err.message);
        return false;
    }
}

async function storeOtpSession(mobile, otp, role) {
    const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await pool.query(
        `INSERT INTO otp_sessions (mobile, otp_hash, role, expires_at, attempts)
         VALUES ($1, $2, $3, $4, 0)
         ON CONFLICT (mobile)
         DO UPDATE SET otp_hash = $2, role = $3, expires_at = $4, attempts = 0`,
        [mobile, otpHash, role, expiresAt]
    );
}

async function verifyOtp(mobile, otp, role) {
    const lockoutRemaining = checkMobileLockout(mobile);
    if (lockoutRemaining !== null) {
        return { valid: false, reason: `Account temporarily locked. Try again in ${lockoutRemaining} seconds.` };
    }

    const result = await pool.query(
        'SELECT * FROM otp_sessions WHERE mobile = $1 AND role = $2',
        [mobile, role]
    );
    if (result.rows.length === 0) {
        recordFailedLogin(mobile);
        return { valid: false, reason: 'No OTP session found. Request a new OTP.' };
    }
    const session = result.rows[0];
    if (new Date() > new Date(session.expires_at)) {
        await pool.query('DELETE FROM otp_sessions WHERE mobile = $1', [mobile]);
        recordFailedLogin(mobile);
        return { valid: false, reason: 'OTP expired. Request a new one.' };
    }
    if (session.attempts >= MAX_ATTEMPTS) {
        await pool.query('DELETE FROM otp_sessions WHERE mobile = $1', [mobile]);
        recordFailedLogin(mobile);
        return { valid: false, reason: 'Too many failed attempts. Request a new OTP.' };
    }
    const match = await bcrypt.compare(otp, session.otp_hash);
    if (!match) {
        await pool.query(
            'UPDATE otp_sessions SET attempts = attempts + 1 WHERE mobile = $1',
            [mobile]
        );
        recordFailedLogin(mobile);
        const remaining = MAX_ATTEMPTS - (session.attempts + 1);
        return { valid: false, reason: `Invalid OTP. ${remaining} attempt(s) remaining.` };
    }
    await pool.query('DELETE FROM otp_sessions WHERE mobile = $1', [mobile]);
    clearFailedLogin(mobile);
    return { valid: true };
}

async function createOrFindUser(mobile, role) {
    const existing = await pool.query(
        'SELECT * FROM users WHERE mobile = $1',
        [mobile]
    );
    if (existing.rows.length > 0) {
        const user = existing.rows[0];
        if (user.role !== role) {
            await pool.query(
                'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
                [role, user.id]
            );
            user.role = role;
        }
        return user;
    }
    const newUser = await pool.query(
        `INSERT INTO users (mobile, role, name)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [mobile, role, `User-${mobile.slice(-4)}`]
    );
    return newUser.rows[0];
}

module.exports = {
    generateOtp,
    sendOtpViaSms,
    storeOtpSession,
    verifyOtp,
    createOrFindUser
};
