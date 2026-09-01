-- KISAN MITRA — Verification Pipeline
-- Two-tier KYC: FPO Stage 1 → Officer Stage 2

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_kyc_status_check;
ALTER TABLE users ADD CONSTRAINT users_kyc_status_check
  CHECK (kyc_status IN ('Pending','FPO_Reviewed','FPO_Rejected','Verified','Rejected'));

CREATE TABLE IF NOT EXISTS verification_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_by UUID NOT NULL REFERENCES users(id),
    reviewer_role VARCHAR(10) NOT NULL CHECK (reviewer_role IN ('fpo','officer')),
    action VARCHAR(20) NOT NULL CHECK (action IN ('approve','reject','override','update')),
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    reason TEXT,
    changed_fields JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_farmer_date ON verification_audit(farmer_id, created_at DESC);
CREATE INDEX idx_audit_reviewer ON verification_audit(reviewed_by);
CREATE INDEX idx_audit_action ON verification_audit(action);
