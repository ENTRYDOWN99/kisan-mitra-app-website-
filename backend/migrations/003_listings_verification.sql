-- KISAN MITRA — Listing Verification Pipeline
-- Two-tier: FPO Stage 1 → Officer Stage 2 → Active (visible to buyers)

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('Active','Sold','Cancelled','Pending','FPO_Reviewed','Rejected'));

ALTER TABLE listings ALTER COLUMN status SET DEFAULT 'Pending';

CREATE TABLE IF NOT EXISTS listing_verification_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    reviewed_by UUID NOT NULL REFERENCES users(id),
    reviewer_role VARCHAR(10) NOT NULL CHECK (reviewer_role IN ('fpo','officer')),
    action VARCHAR(20) NOT NULL CHECK (action IN ('approve','reject')),
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listing_audit_listing ON listing_verification_audit(listing_id, created_at DESC);
CREATE INDEX idx_listing_audit_reviewer ON listing_verification_audit(reviewed_by);
