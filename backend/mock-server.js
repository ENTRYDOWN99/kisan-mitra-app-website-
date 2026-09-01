const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend static files (Android WebView assets)
const publicPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'public');
app.use(express.static(publicPath));

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

// In-memory store
const store = {
    users: [
        { id: 'u1', mobile: '9999999999', role: 'farmer', name: 'Rajesh Kumar', district: 'Nashik', state: 'Maharashtra', kyc_status: 'FPO_Reviewed', is_active: true, created_at: new Date(Date.now() - 86400000 * 10) },
        { id: 'u2', mobile: '9999999998', role: 'buyer', name: 'Sharma Trading Co.', district: 'Mumbai', state: 'Maharashtra', kyc_status: 'Verified', is_active: true, created_at: new Date() },
        { id: 'u3', mobile: '9999999997', role: 'officer', name: 'Priya Desai', district: 'Nashik', state: 'Maharashtra', kyc_status: 'Verified', is_active: true, created_at: new Date() },
        { id: 'u4', mobile: '9999999996', role: 'fpo', name: 'Sahyadri Farmers Producer Co.', district: 'Nashik', state: 'Maharashtra', kyc_status: 'Verified', is_active: true, created_at: new Date() },
        { id: 'u5', mobile: '9999999995', role: 'farmer', name: 'Sunita Devi', district: 'Nashik', state: 'Maharashtra', kyc_status: 'Pending', is_active: true, created_at: new Date(Date.now() - 86400000 * 5) },
        { id: 'u6', mobile: '9999999994', role: 'farmer', name: 'Mohan Patil', district: 'Pune', state: 'Maharashtra', kyc_status: 'Pending', is_active: true, created_at: new Date(Date.now() - 86400000 * 3) },
        { id: 'u7', mobile: '9999999993', role: 'farmer', name: 'Kavita Singh', district: 'Nashik', state: 'Maharashtra', kyc_status: 'FPO_Reviewed', is_active: true, created_at: new Date(Date.now() - 86400000 * 7) },
    ],
    otpSessions: {},
    farmerProfiles: {},
    buyerProfiles: {
        u2: { company_name: 'Sharma Trading Co.', gst_number: '27ABCDE1234F1Z5', category: 'Wholesaler' }
    },
    officerProfiles: {},
    fpoProfiles: { 'u4': { reg_number: 'FPO/2024/MAH/001', member_count: 3, nabard_grade: 'A' } },
    officerProfiles: { 'u3': { employee_id: 'OFF/2023/NASH/042', designation: 'District Agricultural Officer', jurisdiction_district: 'Nashik' } },
    listings: [
        { id: 'l1', farmer_id: 'u1', fpo_id: null, crop: 'Onion', quantity_quintal: 40, price_per_quintal: 850, grade: 'A', description: 'Premium red onions, sun-dried.', status: 'FPO_Reviewed', is_bulk: false, district: 'Nashik', created_at: new Date() },
        { id: 'l2', farmer_id: 'u1', fpo_id: null, crop: 'Tomato', quantity_quintal: 20, price_per_quintal: 1400, grade: 'B', description: 'Standard organic tomatoes.', status: 'Sold', is_bulk: false, district: 'Nashik', created_at: new Date() },
        { id: 'l3', farmer_id: 'u5', fpo_id: null, crop: 'Wheat', quantity_quintal: 150, price_per_quintal: 2100, grade: 'A', description: 'Premium wheat variety.', status: 'Pending', is_bulk: false, district: 'Nashik', created_at: new Date() },
        { id: 'l4', farmer_id: 'u6', fpo_id: null, crop: 'Potato', quantity_quintal: 60, price_per_quintal: 1100, grade: 'A', description: 'Fresh potato harvest.', status: 'Pending', is_bulk: false, district: 'Pune', created_at: new Date() },
        { id: 'l5', farmer_id: 'u7', fpo_id: null, crop: 'Soybean', quantity_quintal: 100, price_per_quintal: 4700, grade: 'B', description: 'Non-GMO soybean.', status: 'Active', is_bulk: false, district: 'Pune', created_at: new Date() },
    ],
    bids: [],
    schemes: [
        { id: 's1', name: 'PM-Kisan Samman Nidhi', department: 'MoA&FW', benefit_description: 'Income support of ₹6,000/year to farmer families in 3 equal instalments.', eligible_roles: ['farmer'], is_active: true, created_at: new Date() },
        { id: 's2', name: 'PM-Fasal Bima Yojana', department: 'MoA&FW', benefit_description: 'Comprehensive crop insurance covering pre-sowing to post-harvest losses.', eligible_roles: ['farmer'], is_active: true, created_at: new Date() },
        { id: 's3', name: 'NABARD FPO Equity Grant', department: 'NABARD', benefit_description: 'Equity grant up to ₹15 lakhs for registered FPOs.', eligible_roles: ['fpo'], is_active: true, created_at: new Date() },
    ],
    schemeApplications: [],
    mandiPrices: [
        { id: 'm1', mandi_name: 'Nashik APMC', state: 'Maharashtra', commodity: 'Onion', price_quintal: 720, msp_quintal: 800, recorded_at: new Date() },
        { id: 'm2', mandi_name: 'Lasalgaon', state: 'Maharashtra', commodity: 'Onion', price_quintal: 740, msp_quintal: 800, recorded_at: new Date() },
        { id: 'm3', mandi_name: 'Azadpur Mandi', state: 'Delhi', commodity: 'Tomato', price_quintal: 1240, msp_quintal: 600, recorded_at: new Date() },
        { id: 'm4', mandi_name: 'Vashi APMC', state: 'Maharashtra', commodity: 'Potato', price_quintal: 1150, msp_quintal: 0, recorded_at: new Date() },
        { id: 'm5', mandi_name: 'Amritsar', state: 'Punjab', commodity: 'Wheat', price_quintal: 2200, msp_quintal: 2275, recorded_at: new Date() },
        { id: 'm6', mandi_name: 'Indore', state: 'Madhya Pradesh', commodity: 'Soybean', price_quintal: 4680, msp_quintal: 4892, recorded_at: new Date() },
    ],
    fpoMembers: { 'u5': 'u4', 'u1': 'u4', 'u7': 'u4' },
    farmerProfiles: {
        'u1': { land_acres: 5, crops: ['Onion', 'Tomato'] },
        'u5': { land_acres: 2, crops: ['Wheat'] },
        'u6': { land_acres: 8, crops: ['Soybean'] },
        'u7': { land_acres: 3, crops: ['Tomato'] }
    },
    notifications: [],
    _auditLog: {
        'audit-1': { id: 'audit-1', farmer_id: 'u1', reviewed_by: 'u4', reviewer_role: 'fpo', action: 'approve', previous_status: 'Pending', new_status: 'FPO_Reviewed', reason: 'Kisan Credit Card and land records verified', changed_fields: null, created_at: new Date(Date.now() - 86400000 * 2) },
        'audit-2': { id: 'audit-2', farmer_id: 'u7', reviewed_by: 'u4', reviewer_role: 'fpo', action: 'approve', previous_status: 'Pending', new_status: 'FPO_Reviewed', reason: 'Aadhaar and land documents matched', changed_fields: null, created_at: new Date(Date.now() - 86400000 * 4) },
    }
};

const LISTING_ID_COUNTER = 6;
const BID_ID_COUNTER = 1;

function generateId() { return require('uuid').v4(); }

function success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({ success: true, message, data });
}
function error(res, message = 'Something went wrong', statusCode = 500, errors = null) {
    const response = { success: false, message };
    if (errors) response.errors = errors;
    return res.status(statusCode).json(response);
}
function paginated(res, rows, total, page, limit) {
    return res.status(200).json({ success: true, data: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return error(res, 'Access token required', 401);
    try {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') return error(res, 'Access token expired', 401);
        return error(res, 'Invalid access token', 401);
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return error(res, 'Unauthorized — no authenticated user', 401);
        if (!roles.includes(req.user.role)) return error(res, `Access denied. Requires role: ${roles.join(' or ')}`, 403);
        next();
    };
}

// ========== HEALTH ==========
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Per-mobile lockout store (5 consecutive wrong OTPs → 15 min block)
const failedLoginStore = new Map();
const FAILED_LOGIN_LIMIT = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

function checkMobileLockout(mobile) {
    const entry = failedLoginStore.get(mobile);
    if (!entry) return null;
    if (Date.now() > entry.lockoutUntil) { failedLoginStore.delete(mobile); return null; }
    return Math.ceil((entry.lockoutUntil - Date.now()) / 1000);
}
function recordFailedLogin(mobile) {
    const now = Date.now();
    let entry = failedLoginStore.get(mobile);
    if (!entry || now > entry.windowStart + FAILED_LOGIN_WINDOW_MS) {
        entry = { count: 1, windowStart: now, lockoutUntil: null };
    } else { entry.count++; }
    if (entry.count >= FAILED_LOGIN_LIMIT) entry.lockoutUntil = now + FAILED_LOGIN_WINDOW_MS;
    failedLoginStore.set(mobile, entry);
}
function clearFailedLogin(mobile) { failedLoginStore.delete(mobile); }

// ========== AUTH ==========
app.post('/api/auth/send-otp', (req, res) => {
    const { mobile, role } = req.body;
    if (!mobile || mobile.length !== 10 || !/^\d+$/.test(mobile)) return error(res, 'Validation failed', 400, [{ field: 'mobile', message: 'Mobile must be 10 digits' }]);
    if (!['farmer', 'buyer', 'officer', 'fpo', 'logistics'].includes(role)) return error(res, 'Validation failed', 400, [{ field: 'role', message: 'Invalid role' }]);
    const otp = '1234';
    store.otpSessions[mobile] = { otp, role, attempts: 0, expiresAt: Date.now() + 600000, createdAt: new Date() };
    console.log(`[DEV] OTP for ${mobile}: ${otp}`);
    success(res, { expiresIn: 600 }, 'OTP sent successfully');
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { mobile, otp, role } = req.body;
    if (!mobile || !otp || !role) return error(res, 'Validation failed', 400, [{ field: 'mobile', message: 'All fields required' }]);
    const lockoutRemaining = checkMobileLockout(mobile);
    if (lockoutRemaining !== null) return error(res, `Account temporarily locked. Try again in ${lockoutRemaining} seconds.`, 429);
    const session = store.otpSessions[mobile];
    if (!session) { recordFailedLogin(mobile); return error(res, 'No OTP session found. Request a new OTP.', 401); }
    if (Date.now() > session.expiresAt) { delete store.otpSessions[mobile]; recordFailedLogin(mobile); return error(res, 'OTP expired. Request a new one.', 401); }
    if (session.attempts >= 3) { delete store.otpSessions[mobile]; recordFailedLogin(mobile); return error(res, 'Too many failed attempts. Request a new OTP.', 401); }
    if (session.otp !== otp) {
        session.attempts++;
        recordFailedLogin(mobile);
        const remaining = 3 - session.attempts;
        return error(res, `Invalid OTP. ${remaining} attempt(s) remaining.`, 401);
    }
    clearFailedLogin(mobile);
    delete store.otpSessions[mobile];
    let user = store.users.find(u => u.mobile === mobile);
    if (!user) {
        user = { id: generateId(), mobile, role, name: `User-${mobile.slice(-4)}`, district: null, state: null, kyc_status: 'Pending', created_at: new Date() };
        store.users.push(user);
    } else if (user.role !== role) {
        user.role = role;
    }
    const payload = { id: user.id, mobile: user.mobile, role: user.role };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
    const refreshToken = jwt.sign(payload, JWT_SECRET + '_refresh', { expiresIn: REFRESH_EXPIRY });
    success(res, { accessToken, refreshToken, user: { id: user.id, mobile: user.mobile, name: user.name, role: user.role, district: user.district, state: user.state, kyc_status: user.kyc_status } }, 'Login successful');
});

app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return error(res, 'Validation failed', 400, [{ field: 'refreshToken', message: 'Refresh token required' }]);
    try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET + '_refresh');
        const user = { id: decoded.id, mobile: decoded.mobile, role: decoded.role };
        const newAccess = jwt.sign(user, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
        success(res, { accessToken: newAccess }, 'Token refreshed');
    } catch (err) {
        return error(res, 'Invalid or expired refresh token', 401);
    }
});

app.post('/api/auth/logout', authenticate, (req, res) => {
    success(res, null, 'Logged out successfully');
});

// ========== PUBLIC ==========
app.get('/api/prices', (req, res) => {
    let result = [...store.mandiPrices];
    if (req.query.commodity) result = result.filter(m => m.commodity.toLowerCase().includes(req.query.commodity.toLowerCase()));
    if (req.query.state) result = result.filter(m => m.state.toLowerCase().includes(req.query.state.toLowerCase()));
    success(res, result);
});

app.get('/api/crops', (req, res) => {
    const crops = [...new Set(store.mandiPrices.map(m => m.commodity))].sort();
    const mspRates = store.mandiPrices.filter(m => m.msp_quintal > 0);
    const latestMsp = [];
    for (const c of crops) {
        const rate = mspRates.filter(m => m.commodity === c);
        if (rate.length) latestMsp.push({ commodity: c, msp: Math.max(...rate.map(r => r.msp_quintal)) });
    }
    success(res, { crops, mspRates: latestMsp });
});

app.get('/api/mandis', (req, res) => {
    const mandis = [...new Map(store.mandiPrices.map(m => [m.mandi_name, { mandi_name: m.mandi_name, state: m.state }])).values()];
    success(res, mandis);
});

// ========== FARMER ==========
app.get('/api/farmer/profile', authenticate, requireRole('farmer'), (req, res) => {
    const user = store.users.find(u => u.id === req.user.id);
    if (!user) return error(res, 'User not found', 404);
    const profile = store.farmerProfiles[user.id] || {};
    success(res, { ...user, ...profile, passwordLastChanged: user.created_at });
});

app.put('/api/farmer/profile', authenticate, requireRole('farmer'), (req, res) => {
    const user = store.users.find(u => u.id === req.user.id);
    if (!user) return error(res, 'User not found', 404);
    const { name, district, state } = req.body;
    if (name) user.name = name;
    if (district) user.district = district;
    if (state) user.state = state;
    success(res, user, 'Profile updated');
});

app.get('/api/farmer/listings', authenticate, requireRole('farmer'), (req, res) => {
    const userListings = store.listings.filter(l => l.farmer_id === req.user.id).map(l => {
        const photos = (store._listingPhotos && store._listingPhotos[l.id]) || [];
        return { ...l, photos };
    });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = userListings.length;
    const paged = userListings.slice((page - 1) * limit, page * limit);
    paginated(res, paged, total, page, limit);
});

app.post('/api/farmer/listings', authenticate, requireRole('farmer'), (req, res) => {
    const { crop, quantity_quintal, price_per_quintal, grade, description, is_bulk, district } = req.body;
    if (!crop || !quantity_quintal || !price_per_quintal || !grade) return error(res, 'Validation failed', 400, [{ field: 'body', message: 'crop, quantity_quintal, price_per_quintal, grade required' }]);
    const id = generateId();
    const listing = { id, farmer_id: req.user.id, fpo_id: null, crop, quantity_quintal, price_per_quintal, grade, description: description || '', status: 'Pending', is_bulk: is_bulk || false, district: district || null, receipt_url: null, receipt_mime_type: null, receipt_uploaded_at: null, created_at: new Date() };
    store.listings.push(listing);
    success(res, listing, 'Listing created', 201);
});

app.post('/api/farmer/listings/:id/submit-for-review', authenticate, requireRole('farmer'), (req, res) => {
    const listing = store.listings.find(l => l.id === req.params.id && l.farmer_id === req.user.id);
    if (!listing) return error(res, 'Listing not found or unauthorized', 404);
    if (listing.status !== 'Pending') return error(res, 'Listing is not in Pending status', 400);
    const photos = (store._listingPhotos && store._listingPhotos[listing.id]) || [];
    const present = new Set(photos.map(p => p.slot));
    const missing = ['overview', 'closeup', 'quality_detail'].filter(s => !present.has(s));
    if (missing.length > 0) return error(res, `Cannot submit — missing photos: ${missing.join(', ')}`, 400);
    success(res, { listingId: listing.id, status: listing.status }, 'Listing submitted for verification');
});

app.post('/api/farmer/listings/:listingId/photos/:slot', authenticate, requireRole('farmer'), (req, res) => {
    const listing = store.listings.find(l => l.id === req.params.listingId && l.farmer_id === req.user.id);
    if (!listing) return error(res, 'Listing not found', 404);
    const { slot } = req.params;
    if (!['overview', 'closeup', 'quality_detail'].includes(slot)) return error(res, 'Invalid slot', 400);
    if (!store._listingPhotos) store._listingPhotos = {};
    if (!store._listingPhotos[listing.id]) store._listingPhotos[listing.id] = [];
    const existing = store._listingPhotos[listing.id].findIndex(p => p.slot === slot);
    const photo = { slot, file_url: `mock/s3/${listing.id}/${slot}-${Date.now()}.jpg`, width_px: slot === 'overview' ? 1024 : slot === 'closeup' ? 2048 : 2560, height_px: slot === 'overview' ? 768 : slot === 'closeup' ? 1536 : 1920 };
    if (existing > -1) store._listingPhotos[listing.id][existing] = photo;
    else store._listingPhotos[listing.id].push(photo);
    success(res, photo, `${slot} photo uploaded`);
});

app.post('/api/farmer/listings/:listingId/receipt', authenticate, requireRole('farmer'), (req, res) => {
    const listing = store.listings.find(l => l.id === req.params.listingId && l.farmer_id === req.user.id);
    if (!listing) return error(res, 'Listing not found', 404);
    listing.receipt_url = `mock/s3/${listing.id}/receipt-${Date.now()}.pdf`;
    listing.receipt_mime_type = 'application/pdf';
    listing.receipt_uploaded_at = new Date();
    success(res, { receipt_url: listing.receipt_url, mime_type: listing.receipt_mime_type }, 'Receipt uploaded');
});

app.put('/api/farmer/listings/:id', authenticate, requireRole('farmer'), (req, res) => {
    const listing = store.listings.find(l => l.id === req.params.id && l.farmer_id === req.user.id);
    if (!listing) return error(res, 'Listing not found', 404);
    Object.assign(listing, req.body);
    // Reset verification status on edit
    if (listing.status !== 'Sold') listing.status = 'Pending';
    success(res, listing, 'Listing updated');
});

app.delete('/api/farmer/listings/:id', authenticate, requireRole('farmer'), (req, res) => {
    const idx = store.listings.findIndex(l => l.id === req.params.id && l.farmer_id === req.user.id);
    if (idx === -1) return error(res, 'Listing not found', 404);
    store.listings.splice(idx, 1);
    success(res, null, 'Listing deleted');
});

app.get('/api/farmer/schemes', authenticate, requireRole('farmer'), (req, res) => {
    const eligible = store.schemes.filter(s => s.eligible_roles.includes('farmer') && s.is_active);
    const applications = store.schemeApplications.filter(a => a.user_id === req.user.id);
    const result = eligible.map(s => ({ ...s, applied: applications.some(a => a.scheme_id === s.id), applicationStatus: (applications.find(a => a.scheme_id === s.id) || {}).status || null }));
    success(res, result);
});

app.post('/api/farmer/schemes/:id/apply', authenticate, requireRole('farmer'), (req, res) => {
    const scheme = store.schemes.find(s => s.id === req.params.id && s.is_active);
    if (!scheme) return error(res, 'Scheme not found', 404);
    const existing = store.schemeApplications.find(a => a.user_id === req.user.id && a.scheme_id === req.params.id);
    if (existing) return error(res, 'Already applied', 409);
    const app_rec = { id: generateId(), user_id: req.user.id, scheme_id: req.params.id, status: 'Applied', created_at: new Date() };
    store.schemeApplications.push(app_rec);
    success(res, app_rec, 'Applied successfully', 201);
});

app.get('/api/farmer/prices', authenticate, requireRole('farmer'), (req, res) => {
    success(res, store.mandiPrices);
});

// ========== BUYER ==========
app.get('/api/buyer/profile', authenticate, requireRole('buyer'), (req, res) => {
    const user = store.users.find(u => u.id === req.user.id);
    if (!user) return error(res, 'User not found', 404);
    const profile = store.buyerProfiles[user.id] || {};
    const userBids = store.bids.filter(b => b.buyer_id === req.user.id);
    success(res, { ...user, ...profile, totalBids: userBids.length, topCrop: 'Onion', volumeTier: 'Silver', creditLimit: 500000 });
});

app.put('/api/buyer/profile', authenticate, requireRole('buyer'), (req, res) => {
    const user = store.users.find(u => u.id === req.user.id);
    if (!user) return error(res, 'User not found', 404);
    const { name, district, state } = req.body;
    if (name) user.name = name;
    if (district) user.district = district;
    if (state) user.state = state;
    success(res, user, 'Profile updated');
});

app.get('/api/buyer/market', authenticate, requireRole('buyer'), (req, res) => {
    const activeListings = store.listings.filter(l => l.status === 'Active');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = activeListings.length;
    const paged = activeListings.slice((page - 1) * limit, page * limit);
    const enriched = paged.map(l => {
        const farmer = store.users.find(u => u.id === l.farmer_id);
        const photos = (store._listingPhotos && store._listingPhotos[l.id]) || [];
        return { ...l, photos, farmerName: farmer ? farmer.name : 'Unknown', farmerDistrict: farmer ? farmer.district : '', farmer_verified: farmer ? farmer.kyc_status === 'Verified' : false };
    });
    paginated(res, enriched, total, page, limit);
});

app.post('/api/buyer/bids', authenticate, requireRole('buyer'), (req, res) => {
    const { listing_id, bid_price, quantity } = req.body;
    if (!listing_id || !bid_price) return error(res, 'Validation failed', 400, [{ field: 'body', message: 'listing_id and bid_price required' }]);
    const listing = store.listings.find(l => l.id === listing_id);
    if (!listing) return error(res, 'Listing not found', 404);
    const bid = { id: generateId(), listing_id, buyer_id: req.user.id, bid_price, quantity: quantity || listing.quantity_quintal, status: 'Pending', created_at: new Date() };
    store.bids.push(bid);
    success(res, bid, 'Bid placed', 201);
});

app.get('/api/buyer/bids', authenticate, requireRole('buyer'), (req, res) => {
    const userBids = store.bids.filter(b => b.buyer_id === req.user.id).map(b => {
        const listing = store.listings.find(l => l.id === b.listing_id);
        const farmer = listing ? store.users.find(u => u.id === listing.farmer_id) : null;
        return { ...b, crop: listing ? listing.crop : 'Unknown', sellerName: farmer ? farmer.name : 'Unknown', listingPrice: listing ? listing.price_per_quintal : 0 };
    });
    success(res, userBids);
});

app.put('/api/buyer/bids/:id', authenticate, requireRole('buyer'), (req, res) => {
    const bid = store.bids.find(b => b.id === req.params.id && b.buyer_id === req.user.id);
    if (!bid) return error(res, 'Bid not found', 404);
    if (bid.status !== 'Pending') return error(res, 'Can only update pending bids', 400);
    if (req.body.bid_price) bid.bid_price = req.body.bid_price;
    if (req.body.status) bid.status = req.body.status;
    success(res, bid, 'Bid updated');
});

app.get('/api/buyer/prices', authenticate, requireRole('buyer'), (req, res) => {
    success(res, store.mandiPrices);
});

// ========== OFFICER VERIFICATION ==========
app.get('/api/officer/verification-queue', authenticate, requireRole('officer'), (req, res) => {
    const farmers = store.users.filter(u => u.role === 'farmer' && ['Pending', 'FPO_Reviewed', 'FPO_Rejected'].includes(u.kyc_status));
    const auditArr = Object.values(store._auditLog || {});
    const enriched = farmers.map(u => {
        const profile = store.farmerProfiles[u.id] || {};
        const fpoActions = auditArr.filter(a => a.farmer_id === u.id && a.reviewer_role === 'fpo');
        const latestFpo = fpoActions.length > 0 ? fpoActions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] : null;
        return { id: u.id, name: u.name, mobile: u.mobile, district: u.district, state: u.state, kyc_status: u.kyc_status, land_acres: profile.land_acres, crops: profile.crops, created_at: u.created_at, fpo_latest_action: latestFpo ? { action: latestFpo.action, new_status: latestFpo.new_status, reviewer_role: latestFpo.reviewer_role, created_at: latestFpo.created_at } : null };
    });
    success(res, enriched);
});

app.get('/api/officer/verification/:farmerId/history', authenticate, requireRole('officer'), (req, res) => {
    const farmer = store.users.find(u => u.id === req.params.farmerId && u.role === 'farmer');
    if (!farmer) return error(res, 'Farmer not found', 404);
    const audit = Object.values(store._auditLog || {}).filter(a => a.farmer_id === req.params.farmerId);
    success(res, { farmer, auditLog: audit });
});

app.put('/api/officer/verification/:farmerId', authenticate, requireRole('officer'), (req, res) => {
    const farmer = store.users.find(u => u.id === req.params.farmerId && u.role === 'farmer');
    if (!farmer) return error(res, 'Farmer not found', 404);
    const { decision, reason, fieldUpdates } = req.body;
    if (!['approve', 'reject', 'override'].includes(decision)) return error(res, 'Invalid decision', 400);
    if ((decision === 'reject' || decision === 'override') && (!reason || reason.length < 10)) return error(res, 'Reason required (min 10 chars)', 400);
    const oldStatus = farmer.kyc_status;
    let newStatus = decision === 'approve' ? 'Verified' : decision === 'reject' ? 'Rejected' : oldStatus === 'Verified' ? 'Rejected' : 'Verified';
    farmer.kyc_status = newStatus;
    if (!store._auditLog) store._auditLog = {};
    const auditId = generateId();
    store._auditLog[auditId] = { id: auditId, farmer_id: req.params.farmerId, reviewed_by: req.user.id, reviewer_role: 'officer', action: decision, previous_status: oldStatus, new_status: newStatus, reason: reason || null, changed_fields: fieldUpdates || null, created_at: new Date() };
    success(res, { farmerId: req.params.farmerId, previousStatus: oldStatus, newStatus });
});

// ========== OFFICER LISTING VERIFICATION ==========
app.get('/api/officer/listings/verification-queue', authenticate, requireRole('officer'), (req, res) => {
    const fpoReviewedListings = store.listings.filter(l => l.status === 'FPO_Reviewed');
    const enriched = fpoReviewedListings.map(l => {
        const farmer = store.users.find(u => u.id === l.farmer_id);
        return { ...l, farmer_name: farmer ? farmer.name : 'Unknown', farmer_mobile: farmer ? farmer.mobile : '', farmer_district: farmer ? farmer.district : '' };
    });
    success(res, enriched);
});

app.put('/api/officer/listings/verification/:id', authenticate, requireRole('officer'), (req, res) => {
    const listing = store.listings.find(l => l.id === req.params.id);
    if (!listing) return error(res, 'Listing not found', 404);
    if (listing.status !== 'FPO_Reviewed') return error(res, 'Listing must be FPO_Reviewed first', 400);
    const { decision, reason } = req.body;
    if (!['approve', 'reject'].includes(decision)) return error(res, 'Invalid decision', 400);
    if (decision === 'reject' && (!reason || reason.length < 10)) return error(res, 'Reason required (min 10 chars)', 400);
    if (decision === 'approve') {
        const photos = (store._listingPhotos && store._listingPhotos[listing.id]) || [];
        const present = new Set(photos.map(p => p.slot));
        const missing = ['overview', 'closeup', 'quality_detail'].filter(s => !present.has(s));
        if (missing.length > 0) return error(res, `Cannot approve — missing photos: ${missing.join(', ')}`, 400);
    }
    const oldStatus = listing.status;
    const newStatus = decision === 'approve' ? 'Active' : 'Rejected';
    listing.status = newStatus;
    if (!store._listingAuditLog) store._listingAuditLog = {};
    const auditId = generateId();
    store._listingAuditLog[auditId] = { id: auditId, listing_id: req.params.id, reviewed_by: req.user.id, reviewer_role: 'officer', action: decision, previous_status: oldStatus, new_status: newStatus, reason: reason || null, created_at: new Date() };
    success(res, { listingId: req.params.id, previousStatus: oldStatus, newStatus });
});

// ========== FPO VERIFICATION ==========
app.get('/api/fpo/verification-queue', authenticate, requireRole('fpo'), (req, res) => {
    const memberIds = Object.entries(store.fpoMembers).filter(([k, v]) => v === req.user.id).map(([k]) => k);
    const farmers = store.users.filter(u => memberIds.includes(u.id) && u.kyc_status === 'Pending');
    success(res, farmers);
});

app.get('/api/fpo/verification/:farmerId/history', authenticate, requireRole('fpo'), (req, res) => {
    if (store.fpoMembers[req.params.farmerId] !== req.user.id) return error(res, 'Farmer is not a member of your FPO', 403);
    const farmer = store.users.find(u => u.id === req.params.farmerId && u.role === 'farmer');
    if (!farmer) return error(res, 'Farmer not found', 404);
    const audit = Object.values(store._auditLog || {}).filter(a => a.farmer_id === req.params.farmerId);
    success(res, { farmer, auditLog: audit });
});

app.put('/api/fpo/verification/:farmerId', authenticate, requireRole('fpo'), (req, res) => {
    if (store.fpoMembers[req.params.farmerId] !== req.user.id) return error(res, 'Farmer is not a member of your FPO', 403);
    const farmer = store.users.find(u => u.id === req.params.farmerId && u.role === 'farmer');
    if (!farmer) return error(res, 'Farmer not found', 404);
    if (farmer.kyc_status !== 'Pending') return error(res, 'This farmer is not in Pending status. Officer may have already acted.', 409);
    const { decision, reason } = req.body;
    if (!['approve', 'reject'].includes(decision)) return error(res, 'Invalid decision', 400);
    if (decision === 'reject' && (!reason || reason.length < 10)) return error(res, 'Reason required (min 10 chars)', 400);
    const oldStatus = farmer.kyc_status;
    const newStatus = decision === 'approve' ? 'FPO_Reviewed' : 'FPO_Rejected';
    farmer.kyc_status = newStatus;
    if (!store._auditLog) store._auditLog = {};
    const auditId = generateId();
    store._auditLog[auditId] = { id: auditId, farmer_id: req.params.farmerId, reviewed_by: req.user.id, reviewer_role: 'fpo', action: decision, previous_status: oldStatus, new_status: newStatus, reason: reason || null, changed_fields: null, created_at: new Date() };
    success(res, { farmerId: req.params.farmerId, previousStatus: oldStatus, newStatus });
});

// ========== FPO LISTING VERIFICATION ==========
app.get('/api/fpo/listings/verification-queue', authenticate, requireRole('fpo'), (req, res) => {
    const memberIds = Object.entries(store.fpoMembers).filter(([k, v]) => v === req.user.id).map(([k]) => k);
    const pendingListings = store.listings.filter(l => memberIds.includes(l.farmer_id) && l.status === 'Pending' && !l.is_bulk);
    const enriched = pendingListings.map(l => {
        const farmer = store.users.find(u => u.id === l.farmer_id);
        return { ...l, farmer_name: farmer ? farmer.name : 'Unknown', farmer_mobile: farmer ? farmer.mobile : '', farmer_district: farmer ? farmer.district : '' };
    });
    success(res, enriched);
});

app.put('/api/fpo/listings/verification/:id', authenticate, requireRole('fpo'), (req, res) => {
    const listing = store.listings.find(l => l.id === req.params.id);
    if (!listing) return error(res, 'Listing not found', 404);
    if (listing.status !== 'Pending') return error(res, 'Listing is not in Pending status', 400);
    const memberIds = Object.entries(store.fpoMembers).filter(([k, v]) => v === req.user.id).map(([k]) => k);
    if (!memberIds.includes(listing.farmer_id)) return error(res, 'Farmer is not a member of your FPO', 403);
    const { decision, reason } = req.body;
    if (!['approve', 'reject'].includes(decision)) return error(res, 'Invalid decision', 400);
    if (decision === 'reject' && (!reason || reason.length < 10)) return error(res, 'Reason required (min 10 chars)', 400);
    if (decision === 'approve') {
        const photos = (store._listingPhotos && store._listingPhotos[listing.id]) || [];
        const present = new Set(photos.map(p => p.slot));
        const missing = ['overview', 'closeup', 'quality_detail'].filter(s => !present.has(s));
        if (missing.length > 0) return error(res, `Cannot approve — missing photos: ${missing.join(', ')}`, 400);
    }
    const oldStatus = listing.status;
    const newStatus = decision === 'approve' ? 'FPO_Reviewed' : 'Rejected';
    listing.status = newStatus;
    if (!store._listingAuditLog) store._listingAuditLog = {};
    const auditId = generateId();
    store._listingAuditLog[auditId] = { id: auditId, listing_id: req.params.id, reviewed_by: req.user.id, reviewer_role: 'fpo', action: decision, previous_status: oldStatus, new_status: newStatus, reason: reason || null, created_at: new Date() };
    success(res, { listingId: req.params.id, previousStatus: oldStatus, newStatus });
});

// ========== FARMER VERIFICATION-STATUS ==========
app.get('/api/farmer/verification-status', authenticate, requireRole('farmer'), (req, res) => {
    const user = store.users.find(u => u.id === req.user.id);
    if (!user) return error(res, 'User not found', 404);
    const audit = Object.values(store._auditLog || {}).filter(a => a.farmer_id === req.user.id);
    success(res, {
        currentKycStatus: user.kyc_status,
        lastUpdated: user.updated_at,
        timeline: audit.map(r => ({
            status: r.new_status,
            reason: r.reason,
            reviewerRole: r.reviewer_role === 'officer' ? 'Officer' : 'FPO',
            timestamp: r.created_at
        }))
    });
});

// ========== OFFICER ==========
app.get('/api/officer/dashboard', authenticate, requireRole('officer'), (req, res) => {
    const totalFarmers = store.users.filter(u => u.role === 'farmer').length;
    const activeListings = store.listings.filter(l => l.status === 'Active').length;
    const totalBids = store.bids.length;
    success(res, { totalFarmers, activeListings, totalBids, registeredToday: 1, pendingKyc: store.users.filter(u => u.kyc_status === 'Pending').length, totalSchemes: store.schemes.length, totalFPOs: store.users.filter(u => u.role === 'fpo').length });
});

app.get('/api/officer/farmers', authenticate, requireRole('officer'), (req, res) => {
    const farmers = store.users.filter(u => u.role === 'farmer').map(u => {
        const profile = store.farmerProfiles[u.id] || {};
        const listingCount = store.listings.filter(l => l.farmer_id === u.id).length;
        return { id: u.id, name: u.name, mobile: u.mobile, district: u.district, state: u.state, kyc_status: u.kyc_status, land_acres: profile.land_acres, crops: profile.crops, listingCount, created_at: u.created_at };
    });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = farmers.length;
    paginated(res, farmers.slice((page - 1) * limit, page * limit), total, page, limit);
});

app.get('/api/officer/farmers/:id', authenticate, requireRole('officer'), (req, res) => {
    const user = store.users.find(u => u.id === req.params.id && u.role === 'farmer');
    if (!user) return error(res, 'Farmer not found', 404);
    const profile = store.farmerProfiles[user.id] || {};
    const listings = store.listings.filter(l => l.farmer_id === user.id);
    success(res, { ...user, ...profile, listings });
});

app.put('/api/officer/farmers/:id/kyc', authenticate, requireRole('officer'), (req, res) => {
    const user = store.users.find(u => u.id === req.params.id && u.role === 'farmer');
    if (!user) return error(res, 'Farmer not found', 404);
    const { status } = req.body;
    if (!['Verified', 'Rejected'].includes(status)) return error(res, 'Validation failed', 400, [{ field: 'status', message: 'Must be Verified or Rejected' }]);
    user.kyc_status = status;
    success(res, { id: user.id, kyc_status: user.kyc_status }, 'KYC updated');
});

app.get('/api/officer/listings', authenticate, requireRole('officer'), (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = store.listings.length;
    const enriched = store.listings.slice((page - 1) * limit, page * limit).map(l => {
        const farmer = store.users.find(u => u.id === l.farmer_id);
        return { ...l, farmerName: farmer ? farmer.name : 'Unknown' };
    });
    paginated(res, enriched, total, page, limit);
});

app.get('/api/officer/schemes', authenticate, requireRole('officer'), (req, res) => {
    success(res, store.schemes.filter(s => s.is_active));
});

app.post('/api/officer/schemes', authenticate, requireRole('officer'), (req, res) => {
    const { name, department, benefit_description, eligible_roles } = req.body;
    if (!name || !benefit_description || !eligible_roles) return error(res, 'Validation failed', 400, [{ field: 'body', message: 'name, benefit_description, eligible_roles required' }]);
    const scheme = { id: generateId(), name, department: department || '', benefit_description, eligible_roles, is_active: true, created_by: req.user.id, created_at: new Date() };
    store.schemes.push(scheme);
    success(res, scheme, 'Scheme created', 201);
});

app.put('/api/officer/schemes/:id', authenticate, requireRole('officer'), (req, res) => {
    const scheme = store.schemes.find(s => s.id === req.params.id);
    if (!scheme) return error(res, 'Scheme not found', 404);
    Object.assign(scheme, req.body);
    success(res, scheme, 'Scheme updated');
});

app.delete('/api/officer/schemes/:id', authenticate, requireRole('officer'), (req, res) => {
    const idx = store.schemes.findIndex(s => s.id === req.params.id);
    if (idx === -1) return error(res, 'Scheme not found', 404);
    store.schemes.splice(idx, 1);
    success(res, null, 'Scheme deleted');
});

app.get('/api/officer/reports', authenticate, requireRole('officer'), (req, res) => {
    const totalFarmers = store.users.filter(u => u.role === 'farmer').length;
    const verifiedFarmers = store.users.filter(u => u.role === 'farmer' && u.kyc_status === 'Verified').length;
    const totalListings = store.listings.length;
    const activeListings = store.listings.filter(l => l.status === 'Active').length;
    const totalBids = store.bids.length;
    const acceptedBids = store.bids.filter(b => b.status === 'Accepted').length;
    const totalFPOs = store.users.filter(u => u.role === 'fpo').length;
    const crops = [...new Set(store.listings.map(l => l.crop))];
    success(res, { summary: { totalFarmers, verifiedFarmers, kycPending: totalFarmers - verifiedFarmers, totalListings, activeListings, totalBids, acceptedBids, totalFPOs, totalSchemes: store.schemes.length }, topCrops: crops.slice(0, 10), districtData: [] });
});

app.post('/api/officer/notifications', authenticate, requireRole('officer'), (req, res) => {
    const { targetRole, message } = req.body;
    if (!targetRole || !message) return error(res, 'Validation failed', 400, [{ field: 'body', message: 'targetRole and message required' }]);
    const notif = { id: generateId(), title: 'New Notification', message, type: 'info', is_read: false, created_at: new Date() };
    if (targetRole === 'all') { store.users.forEach(u => { store.notifications.push({ ...notif, user_id: u.id, id: generateId() }); }); }
    else { store.users.filter(u => u.role === targetRole).forEach(u => { store.notifications.push({ ...notif, user_id: u.id, id: generateId() }); }); }
    success(res, notif, 'Notification sent');
});

// ========== FPO ==========
app.get('/api/fpo/profile', authenticate, requireRole('fpo'), (req, res) => {
    const user = store.users.find(u => u.id === req.user.id);
    if (!user) return error(res, 'User not found', 404);
    const profile = store.fpoProfiles[user.id] || {};
    const memberCount = Object.keys(store.fpoMembers).filter(k => store.fpoMembers[k] === user.id).length;
    success(res, { ...user, ...profile, memberCount });
});

app.put('/api/fpo/profile', authenticate, requireRole('fpo'), (req, res) => {
    const user = store.users.find(u => u.id === req.user.id);
    if (!user) return error(res, 'User not found', 404);
    const { name, district, state } = req.body;
    if (name) user.name = name;
    if (district) user.district = district;
    if (state) user.state = state;
    success(res, user, 'Profile updated');
});

app.get('/api/fpo/members', authenticate, requireRole('fpo'), (req, res) => {
    const memberIds = Object.entries(store.fpoMembers).filter(([k, v]) => v === req.user.id).map(([k]) => k);
    const members = memberIds.map(id => store.users.find(u => u.id === id)).filter(Boolean);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = members.length;
    paginated(res, members.slice((page - 1) * limit, page * limit), total, page, limit);
});

app.post('/api/fpo/members/:farmerId', authenticate, requireRole('fpo'), (req, res) => {
    const farmer = store.users.find(u => u.id === req.params.farmerId && u.role === 'farmer');
    if (!farmer) return error(res, 'Farmer not found', 404);
    store.fpoMembers[req.params.farmerId] = req.user.id;
    success(res, { farmerId: req.params.farmerId }, 'Member added', 201);
});

app.delete('/api/fpo/members/:farmerId', authenticate, requireRole('fpo'), (req, res) => {
    if (!store.fpoMembers[req.params.farmerId]) return error(res, 'Member not found', 404);
    delete store.fpoMembers[req.params.farmerId];
    success(res, null, 'Member removed');
});

app.get('/api/fpo/listings', authenticate, requireRole('fpo'), (req, res) => {
    const fpoListings = store.listings.filter(l => l.fpo_id === req.user.id || (l.farmer_id && store.fpoMembers[l.farmer_id] === req.user.id));
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = fpoListings.length;
    paginated(res, fpoListings.slice((page - 1) * limit, page * limit), total, page, limit);
});

app.post('/api/fpo/listings', authenticate, requireRole('fpo'), (req, res) => {
    const { crop, quantity_quintal, price_per_quintal, grade, description, is_bulk, district } = req.body;
    if (!crop || !quantity_quintal || !price_per_quintal || !grade) return error(res, 'Validation failed', 400, [{ field: 'body', message: 'crop, quantity_quintal, price_per_quintal, grade required' }]);
    const listing = { id: generateId(), farmer_id: null, fpo_id: req.user.id, crop, quantity_quintal, price_per_quintal, grade, description: description || '', status: 'Active', is_bulk: is_bulk || false, district: district || null, created_at: new Date() };
    store.listings.push(listing);
    success(res, listing, 'Listing created', 201);
});

app.put('/api/fpo/listings/:id', authenticate, requireRole('fpo'), (req, res) => {
    const listing = store.listings.find(l => l.id === req.params.id && l.fpo_id === req.user.id);
    if (!listing) return error(res, 'Listing not found', 404);
    Object.assign(listing, req.body);
    success(res, listing, 'Listing updated');
});

app.get('/api/fpo/schemes', authenticate, requireRole('fpo'), (req, res) => {
    const eligible = store.schemes.filter(s => s.eligible_roles.includes('fpo') && s.is_active);
    const applications = store.schemeApplications.filter(a => a.user_id === req.user.id);
    const result = eligible.map(s => ({ ...s, applied: applications.some(a => a.scheme_id === s.id), applicationStatus: (applications.find(a => a.scheme_id === s.id) || {}).status || null }));
    success(res, result);
});

app.post('/api/fpo/schemes/:id/apply', authenticate, requireRole('fpo'), (req, res) => {
    const scheme = store.schemes.find(s => s.id === req.params.id && s.is_active);
    if (!scheme) return error(res, 'Scheme not found', 404);
    const existing = store.schemeApplications.find(a => a.user_id === req.user.id && a.scheme_id === req.params.id);
    if (existing) return error(res, 'Already applied', 409);
    const app_rec = { id: generateId(), user_id: req.user.id, scheme_id: req.params.id, status: 'Applied', created_at: new Date() };
    store.schemeApplications.push(app_rec);
    success(res, app_rec, 'Applied successfully', 201);
});

app.get('/api/fpo/prices', authenticate, requireRole('fpo'), (req, res) => {
    success(res, store.mandiPrices);
});

// ================================================================
// STORAGE — Mock Endpoints
// ================================================================

if (!store._storageFacilities) {
    store._storageFacilities = [
        { id: 'sf1', fpo_id: 'fpo-1', name: 'FPO Nashik Cold Storage', district: 'Nashik', state: 'MH', capacity_quintal: 5000, available_capacity_quintal: 3200, rate_per_quintal_month: 45, accepted_crops: ['Onion', 'Tomato', 'Potato'], is_active: true, created_at: new Date().toISOString() },
        { id: 'sf2', fpo_id: 'fpo-1', name: 'FPO Pune Grain Godown', district: 'Pune', state: 'MH', capacity_quintal: 3000, available_capacity_quintal: 2800, rate_per_quintal_month: 35, accepted_crops: ['Wheat', 'Soybean'], is_active: true, created_at: new Date().toISOString() },
    ];
}
if (!store._storageRequests) {
    store._storageRequests = [
        { id: 'sr1', farmer_id: 'farmer-1', facility_id: 'sf1', crop: 'Onion', quantity_quintal: 200, duration_months: 3, status: 'Requested', requested_at: new Date().toISOString() },
        { id: 'sr2', farmer_id: 'farmer-2', facility_id: 'sf2', crop: 'Wheat', quantity_quintal: 150, duration_months: 2, status: 'FPO_Verified', requested_at: new Date(Date.now() - 86400000).toISOString(), verified_by: 'fpo-1', verified_at: new Date().toISOString() },
    ];
}

// ─── FPO: Facility CRUD ──
app.post('/api/fpo/storage-facilities', authenticate, requireRole('fpo'), (req, res) => {
    const { name, district, state, capacity_quintal, rate_per_quintal_month, accepted_crops } = req.body;
    if (!name || !capacity_quintal || !rate_per_quintal_month) return error(res, 'Validation failed', 400, [{ field: 'name', message: 'Required' }]);
    const facility = { id: uuid(), fpo_id: req.user.id, name, district, state: state || 'MH', capacity_quintal, available_capacity_quintal: capacity_quintal, rate_per_quintal_month, accepted_crops: accepted_crops || [], is_active: true, created_at: new Date().toISOString() };
    store._storageFacilities.push(facility);
    success(res, facility, 'Storage facility created', 201);
});

app.get('/api/fpo/storage-facilities', authenticate, requireRole('fpo'), (req, res) => {
    success(res, store._storageFacilities.filter(f => f.fpo_id === req.user.id));
});

app.put('/api/fpo/storage-facilities/:id', authenticate, requireRole('fpo'), (req, res) => {
    const idx = store._storageFacilities.findIndex(f => f.id === req.params.id && f.fpo_id === req.user.id);
    if (idx === -1) return error(res, 'Facility not found or unauthorized', 404);
    Object.assign(store._storageFacilities[idx], req.body, { updated_at: new Date().toISOString() });
    success(res, store._storageFacilities[idx], 'Facility updated');
});

app.delete('/api/fpo/storage-facilities/:id', authenticate, requireRole('fpo'), (req, res) => {
    const idx = store._storageFacilities.findIndex(f => f.id === req.params.id && f.fpo_id === req.user.id);
    if (idx === -1) return error(res, 'Facility not found or unauthorized', 404);
    store._storageFacilities.splice(idx, 1);
    success(res, null, 'Facility deleted');
});

app.get('/api/fpo/storage-requests', authenticate, requireRole('fpo'), (req, res) => {
    const fpoFacilities = store._storageFacilities.filter(f => f.fpo_id === req.user.id).map(f => f.id);
    const requests = store._storageRequests.filter(r => fpoFacilities.includes(r.facility_id)).map(r => {
        const fac = store._storageFacilities.find(f => f.id === r.facility_id);
        return { ...r, facility_name: fac ? fac.name : '', farmer_name: 'Mock Farmer', farmer_mobile: '9999999999' };
    });
    success(res, requests);
});

app.put('/api/fpo/storage-requests/:id/verify', authenticate, requireRole('fpo'), (req, res) => {
    const idx = store._storageRequests.findIndex(r => {
        const fac = store._storageFacilities.find(f => f.id === r.facility_id);
        return r.id === req.params.id && fac && fac.fpo_id === req.user.id;
    });
    if (idx === -1) return error(res, 'Request not found or unauthorized', 404);
    const { decision } = req.body;
    const newStatus = decision === 'approve' ? 'FPO_Verified' : 'Rejected';
    store._storageRequests[idx].verified_by = req.user.id;
    store._storageRequests[idx].verified_at = new Date().toISOString();
    if (decision === 'approve') {
        const fac = store._storageFacilities.find(f => f.id === store._storageRequests[idx].facility_id);
        if (!fac || fac.available_capacity_quintal < store._storageRequests[idx].quantity_quintal) {
            return error(res, 'Insufficient available capacity — allocation would exceed remaining space', 409);
        }
        fac.available_capacity_quintal -= store._storageRequests[idx].quantity_quintal;
    }
    store._storageRequests[idx].status = newStatus;
    success(res, { requestId: req.params.id, newStatus }, `Storage request ${newStatus}`);
});

// ─── Farmer: Storage ──
app.get('/api/farmer/storage-facilities', authenticate, requireRole('farmer'), (req, res) => {
    success(res, store._storageFacilities.filter(f => f.is_active));
});

app.post('/api/farmer/storage-requests', authenticate, requireRole('farmer'), (req, res) => {
    const { facility_id, crop, quantity_quintal, duration_months } = req.body;
    if (!facility_id || !crop || !quantity_quintal || !duration_months) return error(res, 'Validation failed', 400);
    const facility = store._storageFacilities.find(f => f.id === facility_id && f.is_active);
    if (!facility) return error(res, 'Facility not found or inactive', 404);
    if (facility.available_capacity_quintal < quantity_quintal) return error(res, 'Insufficient available capacity', 400);
    const request = { id: uuid(), farmer_id: req.user.id, facility_id, crop, quantity_quintal, duration_months, status: 'Requested', requested_at: new Date().toISOString() };
    store._storageRequests.push(request);
    success(res, request, 'Storage request submitted', 201);
});

app.get('/api/farmer/storage-requests', authenticate, requireRole('farmer'), (req, res) => {
    const requests = store._storageRequests.filter(r => r.farmer_id === req.user.id).map(r => {
        const fac = store._storageFacilities.find(f => f.id === r.facility_id);
        return { ...r, facility_name: fac ? fac.name : '', district: fac ? fac.district : '', rate_per_quintal_month: fac ? fac.rate_per_quintal_month : 0 };
    });
    success(res, requests);
});

// ─── Officer: Storage Oversight ──
app.get('/api/officer/storage-facilities', authenticate, requireRole('officer'), (req, res) => {
    success(res, store._storageFacilities.map(f => {
        const fpo = store.users.find(u => u.id === f.fpo_id);
        return { ...f, fpo_name: fpo ? fpo.name : 'Unknown' };
    }));
});

app.get('/api/officer/storage-requests', authenticate, requireRole('officer'), (req, res) => {
    const requests = store._storageRequests.map(r => {
        const fac = store._storageFacilities.find(f => f.id === r.facility_id);
        const farmer = store.users.find(u => u.id === r.farmer_id);
        return { ...r, facility_name: fac ? fac.name : '', district: fac ? fac.district : '', farmer_name: farmer ? farmer.name : 'Unknown', farmer_mobile: farmer ? farmer.mobile : '' };
    });
    success(res, requests);
});

app.put('/api/officer/storage-facilities/:id/flag', authenticate, requireRole('officer'), (req, res) => {
    const idx = store._storageFacilities.findIndex(f => f.id === req.params.id);
    if (idx === -1) return error(res, 'Facility not found', 404);
    store._storageFacilities[idx].is_active = false;
    success(res, store._storageFacilities[idx], 'Facility flagged');
});

// ================================================================
// SCHEME APPLICATIONS — Mock Endpoints
// ================================================================

if (!store._schemeApplications) {
    store._schemeApplications = [
        { id: 'sa1', user_id: 'farmer-1', scheme_id: 's1', status: 'Applied', full_name: 'Rajesh Kumar', dob: '1990-05-15', gender: 'Male', mobile: '9999999999', email: 'rajesh@example.com', category: 'OBC', created_at: new Date().toISOString() },
        { id: 'sa2', user_id: 'farmer-2', scheme_id: 's2', status: 'Applied', full_name: 'Kavita Sharma', dob: '1985-11-20', gender: 'Female', mobile: '9999999998', email: 'kavita@example.com', category: 'General', created_at: new Date(Date.now() - 86400000).toISOString() },
    ];
}

app.get('/api/farmer/schemes/applications', authenticate, requireRole('farmer'), (req, res) => {
    const apps = store._schemeApplications.filter(a => a.user_id === req.user.id).map(a => {
        const scheme = store.schemes.find(s => s.id === a.scheme_id);
        return { ...a, scheme_name: scheme ? scheme.name : 'Unknown', benefit_amount: scheme ? scheme.benefit_description : '' };
    });
    success(res, apps);
});

app.get('/api/fpo/scheme-applications', authenticate, requireRole('fpo'), (req, res) => {
    const apps = store._schemeApplications.filter(a => a.status === 'Applied').map(a => {
        const scheme = store.schemes.find(s => s.id === a.scheme_id);
        const farmer = store.users.find(u => u.id === a.user_id);
        return { ...a, scheme_name: scheme ? scheme.name : 'Unknown', name_hindi: scheme ? scheme.name_hindi : '', farmer_name: farmer ? farmer.name : 'Unknown', farmer_mobile: farmer ? farmer.mobile : '' };
    });
    success(res, apps);
});

app.post('/api/fpo/scheme-applications/:id/review', authenticate, requireRole('fpo'), (req, res) => {
    const idx = store._schemeApplications.findIndex(a => a.id === req.params.id);
    if (idx === -1) return error(res, 'Application not found', 404);
    const { decision } = req.body;
    store._schemeApplications[idx].status = decision === 'approve' ? 'Approved' : 'Rejected';
    store._schemeApplications[idx].reviewed_by = req.user.id;
    store._schemeApplications[idx].reviewer_role = 'fpo';
    store._schemeApplications[idx].reviewed_at = new Date().toISOString();
    success(res, store._schemeApplications[idx], `Scheme application ${store._schemeApplications[idx].status}`);
});

app.get('/api/officer/scheme-applications', authenticate, requireRole('officer'), (req, res) => {
    const apps = store._schemeApplications.filter(a => a.status === 'Applied').map(a => {
        const scheme = store.schemes.find(s => s.id === a.scheme_id);
        const farmer = store.users.find(u => u.id === a.user_id);
        return { ...a, scheme_name: scheme ? scheme.name : 'Unknown', name_hindi: scheme ? scheme.name_hindi : '', farmer_name: farmer ? farmer.name : 'Unknown', farmer_mobile: farmer ? farmer.mobile : '', district: farmer ? farmer.district : '' };
    });
    success(res, apps);
});

app.post('/api/officer/scheme-applications/:id/review', authenticate, requireRole('officer'), (req, res) => {
    const idx = store._schemeApplications.findIndex(a => a.id === req.params.id);
    if (idx === -1) return error(res, 'Application not found', 404);
    const { decision } = req.body;
    store._schemeApplications[idx].status = decision === 'approve' ? 'Approved' : 'Rejected';
    store._schemeApplications[idx].reviewed_by = req.user.id;
    store._schemeApplications[idx].reviewer_role = 'officer';
    store._schemeApplications[idx].reviewed_at = new Date().toISOString();
    success(res, store._schemeApplications[idx], `Scheme application ${store._schemeApplications[idx].status}`);
});

// ================================================================
// HISTORY — Mock Endpoints (Officer + FPO)
// ================================================================

function buildHistoryScope(req) {
    const role = req.user.role;
    if (role === 'officer') return { scope: 'all', scopeId: null };
    const memberIds = Object.entries(store.fpoMembers).filter(([k, v]) => v === req.user.id).map(([k]) => k);
    return { scope: 'fpo_members', scopeId: memberIds };
}

function filterCrop(item, crop) { return !crop || (item.crop && item.crop.toLowerCase().includes(crop.toLowerCase())); }
function filterDistrict(item, district, role) { return role === 'officer' ? (!district || (item.farmer_district && item.farmer_district.toLowerCase() === district.toLowerCase())) : true; }
function filterDate(item, from, to, field) {
    const d = new Date(item[field] || item.created_at);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to)) return false;
    return true;
}

// Officer history endpoints
app.get('/api/officer/history/trades', authenticate, requireRole('officer'), getTradeHistory);
app.get('/api/officer/history/logistics', authenticate, requireRole('officer'), getLogisticsHistory);
app.get('/api/officer/history/storage', authenticate, requireRole('officer'), getStorageHistory);
// FPO history endpoints
app.get('/api/fpo/history/trades', authenticate, requireRole('fpo'), getTradeHistory);
app.get('/api/fpo/history/logistics', authenticate, requireRole('fpo'), getLogisticsHistory);
app.get('/api/fpo/history/storage', authenticate, requireRole('fpo'), getStorageHistory);

function getTradeHistory(req, res) {
    const { scope, scopeId } = buildHistoryScope(req);
    const { page = 1, limit = 20, from_date, to_date, crop, district } = req.query;
    const p = parseInt(page), l = parseInt(limit);

    let data = store._historyTrades || [];
    if (scope === 'fpo_members') data = data.filter(d => scopeId.includes(d.farmer_id));
    if (crop) data = data.filter(d => filterCrop(d, crop));
    if (district) data = data.filter(d => filterDistrict(d, district, 'officer'));
    if (from_date || to_date) data = data.filter(d => filterDate(d, from_date, to_date, 'traded_at'));

    const total = data.length;
    data = data.slice((p - 1) * l, p * l);
    paginated(res, data, total, p, l);
}

function getLogisticsHistory(req, res) {
    const { scope, scopeId } = buildHistoryScope(req);
    const { page = 1, limit = 20, from_date, to_date, crop, district } = req.query;
    const p = parseInt(page), l = parseInt(limit);

    let data = store._historyLogistics || [];
    if (scope === 'fpo_members') data = data.filter(d => scopeId.includes(d.farmer_id));
    if (crop) data = data.filter(d => filterCrop(d, crop));
    if (district) data = data.filter(d => filterDistrict(d, district, 'officer'));
    if (from_date || to_date) data = data.filter(d => filterDate(d, from_date, to_date, 'scheduled_pickup_at'));

    const total = data.length;
    data = data.slice((p - 1) * l, p * l);
    paginated(res, data, total, p, l);
}

function getStorageHistory(req, res) {
    const { scope, scopeId } = buildHistoryScope(req);
    const { page = 1, limit = 20, from_date, to_date, crop, district } = req.query;
    const p = parseInt(page), l = parseInt(limit);

    let data = store._historyStorage || [];
    if (scope === 'fpo_members') data = data.filter(d => scopeId.includes(d.farmer_id));
    if (crop) data = data.filter(d => filterCrop(d, crop));
    if (district) data = data.filter(d => filterDistrict(d, district, 'officer'));
    if (from_date || to_date) data = data.filter(d => filterDate(d, from_date, to_date, 'scheduled_pickup_at'));

    const total = data.length;
    data = data.slice((p - 1) * l, p * l);
    paginated(res, data, total, p, l);
}

// Seed history data (runs once)
if (!store._historySeeded) {
    store._historySeeded = true;

    store._historyTrades = [
        { listing_id: 'l2', crop: 'Tomato', quantity_quintal: 20, farmer_name: 'Rajesh Kumar', farmer_id: 'u1', farmer_district: 'Nashik', buyer_name: 'Sharma Trading Co.', bid_price: 1350, bid_status: 'Accepted', listing_price: 1400, traded_at: new Date(Date.now() - 86400000 * 12).toISOString() },
        { listing_id: 'l5', crop: 'Soybean', quantity_quintal: 100, farmer_name: 'Kavita Singh', farmer_id: 'u7', farmer_district: 'Pune', buyer_name: 'Sharma Trading Co.', bid_price: 4600, bid_status: 'Accepted', listing_price: 4700, traded_at: new Date(Date.now() - 86400000 * 5).toISOString() },
    ];

    store._historyLogistics = [
        { shipment_id: 'ship-1', farmer_name: 'Rajesh Kumar', farmer_id: 'u1', crop: 'Onion', quantity_quintal: 40, logistics_company: 'QuickHaul Logistics', pickup_location: 'Nashik Farm, Nashik', drop_location: 'Mandi Warehouse, Mumbai', status: 'Delivered', scheduled_pickup_at: new Date(Date.now() - 86400000 * 8).toISOString(), delivered_at: new Date(Date.now() - 86400000 * 6).toISOString() },
        { shipment_id: 'ship-2', farmer_name: 'Kavita Singh', farmer_id: 'u7', crop: 'Soybean', quantity_quintal: 100, logistics_company: 'QuickHaul Logistics', pickup_location: 'Kavita Farm, Pune', drop_location: 'Solvent Plant, Pune', status: 'In_Transit', scheduled_pickup_at: new Date(Date.now() - 86400000 * 2).toISOString(), delivered_at: null },
    ];

    store._historyStorage = [
        { shipment_id: 'ship-3', farmer_name: 'Rajesh Kumar', farmer_id: 'u1', crop: 'Onion', quantity_quintal: 200, logistics_company: 'FarmLink Logistics', facility_name: 'FPO Nashik Cold Storage', facility_district: 'Nashik', pickup_location: 'Rajesh Farm, Nashik', drop_location: 'Nashik Cold Storage', status: 'Delivered', scheduled_pickup_at: new Date(Date.now() - 86400000 * 15).toISOString(), delivered_at: new Date(Date.now() - 86400000 * 13).toISOString() },
        { shipment_id: 'ship-4', farmer_name: 'Sunita Devi', farmer_id: 'u5', crop: 'Wheat', quantity_quintal: 150, logistics_company: 'FarmLink Logistics', facility_name: 'FPO Pune Grain Godown', facility_district: 'Pune', pickup_location: 'Sunita Farm, Nashik', drop_location: 'Pune Grain Godown', status: 'Booked', scheduled_pickup_at: new Date(Date.now() + 86400000 * 3).toISOString(), delivered_at: null },
    ];
}

// ================================================================
// LOGISTICS — Mock Endpoints
// ================================================================

if (!store._shipments) {
    store._shipments = [];
}
if (!store._trackingPings) {
    store._trackingPings = [];
}
if (!store._shipmentPayments) {
    store._shipmentPayments = [];
}
if (!store._logisticsProfiles) {
    store._logisticsProfiles = [];
}

// Profile
app.get('/api/logistics/profile', authenticate, requireRole('logistics'), (req, res) => {
    const user = store.users.find(u => u.id === req.user.id);
    const profile = store._logisticsProfiles.find(p => p.user_id === req.user.id);
    if (!user) return error(res, 'User not found', 404);
    success(res, { ...user, profile: profile || null });
});

app.put('/api/logistics/profile', authenticate, requireRole('logistics'), (req, res) => {
    const { company_name, gst_number, license_number, service_area, fleet_size } = req.body;
    let profile = store._logisticsProfiles.find(p => p.user_id === req.user.id);
    if (profile) Object.assign(profile, { company_name, gst_number, license_number, service_area, fleet_size });
    else {
        profile = { user_id: req.user.id, company_name, gst_number, license_number, service_area, fleet_size };
        store._logisticsProfiles.push(profile);
    }
    success(res, profile, 'Profile updated');
});

// Orders
app.get('/api/logistics/orders', authenticate, requireRole('logistics'), (req, res) => {
    const acceptedBids = store.bids.filter(b => b.status === 'Accepted').map(b => {
        const listing = store.listings.find(l => l.id === b.listing_id);
        const farmer = store.users.find(u => listing && u.id === listing.farmer_id);
        const buyer = store.users.find(u => u.id === b.buyer_id);
        return { ...b, crop: listing ? listing.crop : '', quantity_quintal: listing ? listing.quantity_quintal : 0, district: listing ? listing.district : '', farmer_name: farmer ? farmer.name : '', buyer_name: buyer ? buyer.name : '', buyer_mobile: buyer ? buyer.mobile : '' };
    });
    success(res, acceptedBids);
});

// Shipments
app.post('/api/logistics/shipments', authenticate, requireRole('logistics'), (req, res) => {
    const { purpose, bid_id, storage_request_id, pickup_location, drop_location, crop, quantity_quintal, vehicle_type, scheduled_pickup_at } = req.body;
    if (!pickup_location || !drop_location) return error(res, 'Validation failed', 400);
    const p = purpose || 'buyer_delivery';
    if (p === 'buyer_delivery' && !bid_id) return error(res, 'bid_id required for buyer_delivery', 400);
    if (p === 'storage_delivery' && !storage_request_id) return error(res, 'storage_request_id required for storage_delivery', 400);
    const shipment = { id: uuid(), purpose: p, bid_id: bid_id || null, storage_request_id: storage_request_id || null, logistics_id: req.user.id, pickup_location, drop_location, crop: crop || null, quantity_quintal: quantity_quintal || null, vehicle_type: vehicle_type || null, scheduled_pickup_at: scheduled_pickup_at || null, status: 'Booked', created_at: new Date().toISOString() };
    store._shipments.push(shipment);
    success(res, shipment, 'Shipment booked', 201);
});

app.get('/api/logistics/shipments', authenticate, requireRole('logistics'), (req, res) => {
    success(res, store._shipments.filter(s => s.logistics_id === req.user.id));
});

app.put('/api/logistics/shipments/:id/status', authenticate, requireRole('logistics'), (req, res) => {
    const idx = store._shipments.findIndex(s => s.id === req.params.id && s.logistics_id === req.user.id);
    if (idx === -1) return error(res, 'Shipment not found or unauthorized', 404);
    const validStatuses = ['Booked', 'Picked_Up', 'In_Transit', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(req.body.status)) return error(res, 'Invalid status', 400);
    store._shipments[idx].status = req.body.status;
    store._shipments[idx].updated_at = new Date().toISOString();
    success(res, store._shipments[idx], `Shipment status updated to ${req.body.status}`);
});

// Tracking
app.post('/api/logistics/shipments/:id/tracking', authenticate, requireRole('logistics'), (req, res) => {
    const shipment = store._shipments.find(s => s.id === req.params.id && s.logistics_id === req.user.id);
    if (!shipment) return error(res, 'Shipment not found or unauthorized', 404);
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) return error(res, 'latitude and longitude required', 400);
    const ping = { id: uuid(), shipment_id: req.params.id, latitude, longitude, recorded_at: new Date().toISOString() };
    store._trackingPings.push(ping);
    success(res, ping, 'Tracking ping recorded', 201);
});

app.get('/api/logistics/shipments/:id/tracking', authenticate, requireRole('logistics'), (req, res) => {
    success(res, store._trackingPings.filter(p => p.shipment_id === req.params.id));
});

// Payments
app.get('/api/logistics/payments', authenticate, requireRole('logistics'), (req, res) => {
    const payments = store._shipmentPayments.filter(p => {
        const shipment = store._shipments.find(s => s.id === p.shipment_id);
        return shipment && shipment.logistics_id === req.user.id;
    }).map(p => {
        const shipment = store._shipments.find(s => s.id === p.shipment_id);
        return { ...p, pickup_location: shipment ? shipment.pickup_location : '', drop_location: shipment ? shipment.drop_location : '', crop: shipment ? shipment.crop : '' };
    });
    success(res, payments);
});

app.post('/api/logistics/payments/:id/mark-paid', authenticate, requireRole('logistics'), (req, res) => {
    const { amount, status, method, transaction_ref } = req.body;
    if (!amount || !status) return error(res, 'Validation failed', 400);
    const payment = { id: uuid(), shipment_id: req.params.id, amount, status, method: method || null, transaction_ref: transaction_ref || null, created_at: new Date().toISOString() };
    store._shipmentPayments.push(payment);
    success(res, payment, 'Payment recorded', 201);
});

// ================================================================
// Start
// ================================================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`KISAN MITRA API running on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
});

module.exports = { app, server };
