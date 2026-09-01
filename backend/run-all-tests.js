// Kisan Mitra Backend — Comprehensive API Test Suite
const http = require('http');

const BASE = 'http://127.0.0.1:3000';
const results = [];

function req(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const opts = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) opts.headers['Authorization'] = `Bearer ${token}`;
        const r = http.request(opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        r.on('error', reject);
        if (body) r.write(JSON.stringify(body));
        r.end();
    });
}

function record(id, endpoint, expectedStatus, actual, passCondition) {
    const passed = typeof passCondition === 'function' ? passCondition(actual) : actual.status === expectedStatus;
    results.push({ id, endpoint, expectedStatus, actualStatus: actual.status, passed, body: actual.body });
    console.log(`${passed ? '✅' : '❌'} ${id}: ${endpoint} => ${actual.status} ${passed ? 'PASS' : 'FAIL'}`);
}

async function run() {
    console.log('=== KISAN MITRA API TEST SUITE ===\n');

    // 1. Health
    let r = await req('GET', '/health');
    record('T1', 'GET /health', 200, r, r => r.body.status === 'ok');

    // 2. Send OTP (farmer)
    r = await req('POST', '/api/auth/send-otp', { mobile: '9999999999', role: 'farmer' });
    record('T2', 'POST /api/auth/send-otp', 200, r, r => r.body.success && r.body.data.expiresIn === 600);

    // 3. Verify OTP (farmer)
    r = await req('POST', '/api/auth/verify-otp', { mobile: '9999999999', otp: '1234', role: 'farmer' });
    record('T3', 'POST /api/auth/verify-otp', 200, r, r => r.body.success && r.body.data.accessToken);
    const farmerToken = r.body.data?.accessToken;

    // 4. Farmer Profile
    r = await req('GET', '/api/farmer/profile', null, farmerToken);
    record('T4', 'GET /api/farmer/profile', 200, r, r => r.body.data.name === 'Rajesh Kumar');

    // 5. Farmer Listings
    r = await req('GET', '/api/farmer/listings', null, farmerToken);
    record('T5', 'GET /api/farmer/listings', 200, r, r => Array.isArray(r.body.data));

    // 6. Create Listing
    r = await req('POST', '/api/farmer/listings', { crop: 'Chilli', quantity_quintal: 25, price_per_quintal: 8900, grade: 'A' }, farmerToken);
    record('T6', 'POST /api/farmer/listings', 201, r, r => r.body.success);

    // 7. Farmer Schemes
    r = await req('GET', '/api/farmer/schemes', null, farmerToken);
    record('T7', 'GET /api/farmer/schemes', 200, r, r => Array.isArray(r.body.data));

    // 8. Apply Scheme
    r = await req('POST', '/api/farmer/schemes/s1/apply', null, farmerToken);
    record('T8', 'POST /api/farmer/schemes/:id/apply', 201, r, r => r.body.success);

    // 9. Duplicate Scheme Application (should fail)
    r = await req('POST', '/api/farmer/schemes/s1/apply', null, farmerToken);
    record('T9', 'POST /api/farmer/schemes/:id/apply (duplicate)', 409, r, r => !r.body.success);

    // 10. Update Listing
    r = await req('PUT', '/api/farmer/listings/l1', { price_per_quintal: 900 }, farmerToken);
    record('T10', 'PUT /api/farmer/listings/:id', 200, r, r => r.body.success);

    // 11. Delete Listing
    const newListingId = r.body.data?.id || 'l1';
    r = await req('DELETE', `/api/farmer/listings/l2`, null, farmerToken);
    record('T11', 'DELETE /api/farmer/listings/:id', 200, r, r => r.body.success);

    // Public endpoints
    r = await req('GET', '/api/prices');
    record('T12', 'GET /api/prices', 200, r, r => Array.isArray(r.body.data) && r.body.data.length > 0);

    r = await req('GET', '/api/crops');
    record('T13', 'GET /api/crops', 200, r, r => Array.isArray(r.body.data?.crops));

    r = await req('GET', '/api/mandis');
    record('T14', 'GET /api/mandis', 200, r, r => Array.isArray(r.body.data));

    // Buyer flow
    r = await req('POST', '/api/auth/send-otp', { mobile: '9999999998', role: 'buyer' });
    record('T15', 'POST /api/auth/send-otp (buyer)', 200, r, r => r.body.success);

    r = await req('POST', '/api/auth/verify-otp', { mobile: '9999999998', otp: '1234', role: 'buyer' });
    record('T16', 'POST /api/auth/verify-otp (buyer)', 200, r, r => r.body.success);
    const buyerToken = r.body.data?.accessToken;

    r = await req('GET', '/api/buyer/profile', null, buyerToken);
    record('T17', 'GET /api/buyer/profile', 200, r, r => r.body.data.name === 'Sharma Trading Co.');

    r = await req('GET', '/api/buyer/market', null, buyerToken);
    record('T18', 'GET /api/buyer/market', 200, r, r => Array.isArray(r.body.data));

    r = await req('POST', '/api/buyer/bids', { listing_id: 'l1', bid_price: 810, quantity: 40 }, buyerToken);
    record('T19', 'POST /api/buyer/bids', 201, r, r => r.body.success);
    const bidId = r.body.data?.id;

    r = await req('GET', '/api/buyer/bids', null, buyerToken);
    record('T20', 'GET /api/buyer/bids', 200, r, r => Array.isArray(r.body.data));

    r = await req('PUT', `/api/buyer/bids/${bidId}`, { bid_price: 800 }, buyerToken);
    record('T21', 'PUT /api/buyer/bids/:id', 200, r, r => r.body.success);

    r = await req('GET', '/api/buyer/prices', null, buyerToken);
    record('T22', 'GET /api/buyer/prices', 200, r, r => Array.isArray(r.body.data));

    // Officer flow
    r = await req('POST', '/api/auth/send-otp', { mobile: '9999999997', role: 'officer' });
    r = await req('POST', '/api/auth/verify-otp', { mobile: '9999999997', otp: '1234', role: 'officer' });
    record('T23', 'POST /api/auth/verify-otp (officer)', 200, r, r => r.body.success);
    const officerToken = r.body.data?.accessToken;

    r = await req('GET', '/api/officer/dashboard', null, officerToken);
    record('T24', 'GET /api/officer/dashboard', 200, r, r => r.body.data?.totalFarmers >= 1);

    r = await req('GET', '/api/officer/farmers', null, officerToken);
    record('T25', 'GET /api/officer/farmers', 200, r, r => Array.isArray(r.body.data));

    r = await req('GET', '/api/officer/listings', null, officerToken);
    record('T26', 'GET /api/officer/listings', 200, r, r => Array.isArray(r.body.data));

    r = await req('GET', '/api/officer/schemes', null, officerToken);
    record('T27', 'GET /api/officer/schemes', 200, r, r => Array.isArray(r.body.data));

    r = await req('POST', '/api/officer/schemes', { name: 'Test Scheme', benefit_description: 'Test', eligible_roles: ['farmer'] }, officerToken);
    record('T28', 'POST /api/officer/schemes', 201, r, r => r.body.success);

    r = await req('GET', '/api/officer/reports', null, officerToken);
    record('T29', 'GET /api/officer/reports', 200, r, r => r.body.data?.summary);

    r = await req('GET', '/api/officer/farmers/u1', null, officerToken);
    record('T30', 'GET /api/officer/farmers/:id', 200, r, r => r.body.data?.name === 'Rajesh Kumar');

    r = await req('PUT', '/api/officer/farmers/u1/kyc', { status: 'Verified' }, officerToken);
    record('T31', 'PUT /api/officer/farmers/:id/kyc', 200, r, r => r.body.success);

    r = await req('POST', '/api/officer/notifications', { targetRole: 'all', message: 'Test notification' }, officerToken);
    record('T32', 'POST /api/officer/notifications', 200, r, r => r.body.success);

    // FPO flow
    r = await req('POST', '/api/auth/send-otp', { mobile: '9999999996', role: 'fpo' });
    r = await req('POST', '/api/auth/verify-otp', { mobile: '9999999996', otp: '1234', role: 'fpo' });
    record('T33', 'POST /api/auth/verify-otp (fpo)', 200, r, r => r.body.success);
    const fpoToken = r.body.data?.accessToken;

    r = await req('GET', '/api/fpo/profile', null, fpoToken);
    record('T34', 'GET /api/fpo/profile', 200, r, r => r.body.data?.name);

    r = await req('GET', '/api/fpo/members', null, fpoToken);
    record('T35', 'GET /api/fpo/members', 200, r, r => Array.isArray(r.body.data));

    r = await req('POST', '/api/fpo/members/u1', null, fpoToken);
    record('T36', 'POST /api/fpo/members/:farmerId', 201, r, r => r.body.success);

    r = await req('POST', '/api/fpo/listings', { crop: 'Wheat', quantity_quintal: 100, price_per_quintal: 2200, grade: 'A', is_bulk: true }, fpoToken);
    record('T37', 'POST /api/fpo/listings (bulk)', 201, r, r => r.body.success);

    r = await req('GET', '/api/fpo/listings', null, fpoToken);
    record('T38', 'GET /api/fpo/listings', 200, r, r => Array.isArray(r.body.data));

    r = await req('GET', '/api/fpo/schemes', null, fpoToken);
    record('T39', 'GET /api/fpo/schemes', 200, r, r => Array.isArray(r.body.data));

    r = await req('GET', '/api/fpo/prices', null, fpoToken);
    record('T40', 'GET /api/fpo/prices', 200, r, r => Array.isArray(r.body.data));

    // Negative / Edge cases
    r = await req('GET', '/api/farmer/profile', null, null);
    record('T41', 'GET /api/farmer/profile (no auth)', 401, r, r => !r.body.success);

    r = await req('GET', '/api/officer/dashboard', null, farmerToken);
    record('T42', 'GET /api/officer/dashboard (wrong role)', 403, r, r => !r.body.success);

    r = await req('POST', '/api/auth/verify-otp', { mobile: '9999999999', otp: '0000', role: 'farmer' });
    record('T43', 'POST /api/auth/verify-otp (wrong OTP)', 401, r, r => !r.body.success);

    r = await req('POST', '/api/auth/send-otp', { mobile: '123', role: 'farmer' });
    record('T44', 'POST /api/auth/send-otp (invalid mobile)', 400, r, r => !r.body.success);

    r = await req('POST', '/api/auth/refresh', {});
    record('T45', 'POST /api/auth/refresh (no token)', 400, r, r => !r.body.success);

    // Refresh token
    r = await req('POST', '/api/auth/verify-otp', { mobile: '9999999995', otp: '1234', role: 'farmer' });
    const newUserToken = r.body.data?.refreshToken;
    r = await req('POST', '/api/auth/refresh', { refreshToken: newUserToken || 'invalid' });
    record('T46', 'POST /api/auth/refresh', 200, r, r => r.body.success);

    // Token expiry test (use expired token)
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InUxIiwibW9iaWxlIjoiOTk5OTk5OTk5OSIsInJvbGUiOiJmYXJtZXIiLCJpYXQiOjE1MDAwMDAwMDAsImV4cCI6MTUwMDAwMDAwMHQ.dGVzdA';
    r = await req('GET', '/api/farmer/profile', null, expiredToken);
    record('T47', 'GET /api/farmer/profile (expired token)', 401, r, r => !r.body.success);

    // Summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`\n========================================`);
    console.log(`RESULTS: ${passed} PASSED / ${failed} FAILED / ${results.length} TOTAL`);
    console.log(`========================================`);

    if (failed > 0) {
        console.log(`\n❌ Failed Tests:`);
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  ${r.id}: ${r.endpoint} => expected ${r.expectedStatus} got ${r.actualStatus}`);
        });
    }
}

run().catch(console.error);
