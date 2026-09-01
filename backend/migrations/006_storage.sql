-- KISAN MITRA — Chain 3: Storage Facilities & Requests

CREATE TABLE IF NOT EXISTS storage_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fpo_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    district VARCHAR(100),
    state VARCHAR(100),
    capacity_quintal DECIMAL(10,2) NOT NULL,
    available_capacity_quintal DECIMAL(10,2) NOT NULL,
    rate_per_quintal_month DECIMAL(10,2) NOT NULL,
    accepted_crops TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES users(id),
    facility_id UUID NOT NULL REFERENCES storage_facilities(id),
    crop VARCHAR(100) NOT NULL,
    quantity_quintal DECIMAL(10,2) NOT NULL,
    duration_months INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'Requested'
        CHECK (status IN ('Requested','FPO_Verified','Stored','Rejected','Completed')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_storage_req_farmer ON storage_requests(farmer_id);
CREATE INDEX IF NOT EXISTS idx_storage_req_facility ON storage_requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_storage_facility_fpo ON storage_facilities(fpo_id);
