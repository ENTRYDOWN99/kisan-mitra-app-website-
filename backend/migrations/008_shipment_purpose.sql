ALTER TABLE shipments
    ALTER COLUMN bid_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'buyer_delivery'
        CHECK (purpose IN ('buyer_delivery', 'storage_delivery')),
    ADD COLUMN IF NOT EXISTS storage_request_id UUID REFERENCES storage_requests(id),
    ADD COLUMN IF NOT EXISTS farmer_id UUID REFERENCES users(id);

ALTER TABLE shipments
    ADD CONSTRAINT chk_shipment_purpose_reference CHECK (
        (purpose = 'buyer_delivery' AND bid_id IS NOT NULL AND storage_request_id IS NULL)
        OR
        (purpose = 'storage_delivery' AND storage_request_id IS NOT NULL AND bid_id IS NULL)
    );

UPDATE shipments s
SET farmer_id = l.farmer_id
FROM bids b JOIN listings l ON b.listing_id = l.id
WHERE s.bid_id = b.id AND s.farmer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_farmer ON shipments(farmer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_purpose ON shipments(purpose);
