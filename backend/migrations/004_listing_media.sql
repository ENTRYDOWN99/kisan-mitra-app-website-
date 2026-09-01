-- KISAN MITRA — Chain 1: Listing Media (photos + receipt)
-- Extends listings with receipt upload and creates listing_photos table.

CREATE TABLE IF NOT EXISTS listing_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    slot VARCHAR(20) NOT NULL CHECK (slot IN ('overview','closeup','quality_detail')),
    file_url TEXT NOT NULL,
    width_px INTEGER NOT NULL,
    height_px INTEGER NOT NULL,
    file_size_bytes INTEGER,
    mime_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(listing_id, slot)
);

CREATE INDEX idx_listing_photos_listing ON listing_photos(listing_id);

ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS receipt_url TEXT,
    ADD COLUMN IF NOT EXISTS receipt_mime_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS receipt_uploaded_at TIMESTAMPTZ;

CREATE INDEX idx_listings_active ON listings(status) WHERE status = 'Active';
