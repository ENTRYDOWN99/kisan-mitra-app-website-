-- KISAN MITRA — Chain 6: Logistics Role

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('farmer','buyer','officer','fpo','logistics'));

CREATE TABLE IF NOT EXISTS logistics_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255),
    gst_number VARCHAR(15),
    license_number VARCHAR(50),
    service_area TEXT[],
    fleet_size INTEGER
);

CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id UUID REFERENCES bids(id),
    logistics_id UUID NOT NULL REFERENCES users(id),
    pickup_location TEXT NOT NULL,
    drop_location TEXT NOT NULL,
    crop VARCHAR(100),
    quantity_quintal DECIMAL(10,2),
    vehicle_type VARCHAR(50),
    scheduled_pickup_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'Booked'
        CHECK (status IN ('Booked','Picked_Up','In_Transit','Delivered','Cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_tracking_pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending'
        CHECK (status IN ('Pending','Paid','Failed','Refunded')),
    method VARCHAR(30),
    transaction_ref VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_logistics ON shipments(logistics_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_tracking_shipment ON shipment_tracking_pings(shipment_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_payments_shipment ON shipment_payments(shipment_id);
