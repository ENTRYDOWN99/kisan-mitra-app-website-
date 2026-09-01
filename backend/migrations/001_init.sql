-- KISAN MITRA — Initial Database Schema
-- Run: psql -d kisanmitra -f migrations/001_init.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mobile VARCHAR(10) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('farmer','buyer','officer','fpo')),
    name VARCHAR(255) NOT NULL,
    district VARCHAR(100),
    state VARCHAR(100),
    kyc_status VARCHAR(20) DEFAULT 'Pending' CHECK (kyc_status IN ('Pending','Verified','Rejected')),
    bank_linked BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE farmer_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    aadhaar_last4 VARCHAR(4),
    land_acres DECIMAL(8,2),
    crops TEXT[]
);

CREATE TABLE buyer_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255),
    gst_number VARCHAR(15),
    category VARCHAR(50)
);

CREATE TABLE officer_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE,
    designation VARCHAR(100),
    jurisdiction_district VARCHAR(100)
);

CREATE TABLE fpo_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    reg_number VARCHAR(50) UNIQUE,
    member_count INTEGER DEFAULT 0,
    nabard_grade VARCHAR(10)
);

CREATE TABLE otp_sessions (
    mobile VARCHAR(10) PRIMARY KEY,
    otp_hash VARCHAR(64) NOT NULL,
    role VARCHAR(20) NOT NULL,
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID REFERENCES users(id),
    fpo_id UUID REFERENCES users(id),
    crop VARCHAR(100) NOT NULL,
    quantity_quintal DECIMAL(10,2) NOT NULL,
    price_per_quintal DECIMAL(10,2) NOT NULL,
    grade VARCHAR(5) CHECK (grade IN ('A','B','C')),
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active','Sold','Cancelled','Pending')),
    is_bulk BOOLEAN DEFAULT false,
    district VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES listings(id),
    buyer_id UUID REFERENCES users(id),
    bid_price DECIMAL(10,2) NOT NULL,
    quantity DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Accepted','Rejected','Withdrawn')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    benefit_description TEXT,
    eligible_roles TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scheme_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    scheme_id UUID REFERENCES schemes(id),
    status VARCHAR(20) DEFAULT 'Applied' CHECK (status IN ('Applied','Approved','Rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, scheme_id)
);

CREATE TABLE mandi_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mandi_name VARCHAR(100),
    state VARCHAR(100),
    commodity VARCHAR(100),
    price_quintal DECIMAL(10,2),
    msp_quintal DECIMAL(10,2) DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fpo_members (
    fpo_id UUID REFERENCES users(id),
    farmer_id UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (fpo_id, farmer_id)
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info','warning','alert','success')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_mobile ON users(mobile);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_district ON users(district);
CREATE INDEX idx_users_kyc ON users(kyc_status);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_farmer ON listings(farmer_id);
CREATE INDEX idx_listings_crop ON listings(crop);
CREATE INDEX idx_bids_listing ON bids(listing_id);
CREATE INDEX idx_bids_buyer ON bids(buyer_id);
CREATE INDEX idx_mandi_commodity ON mandi_prices(commodity);
CREATE INDEX idx_mandi_recorded ON mandi_prices(recorded_at DESC);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
