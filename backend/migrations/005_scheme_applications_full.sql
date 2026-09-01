-- KISAN MITRA — Chain 2: Full Scheme Applications
-- Extends schemes + scheme_applications; adds documents table

ALTER TABLE schemes
    ADD COLUMN IF NOT EXISTS name_hindi VARCHAR(255),
    ADD COLUMN IF NOT EXISTS implementing_agency VARCHAR(255),
    ADD COLUMN IF NOT EXISTS benefit_amount VARCHAR(100),
    ADD COLUMN IF NOT EXISTS eligibility_criteria TEXT,
    ADD COLUMN IF NOT EXISTS application_deadline DATE,
    ADD COLUMN IF NOT EXISTS fpo_internal_notes TEXT,
    ADD COLUMN IF NOT EXISTS requires_pan BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS requires_alt_id BOOLEAN DEFAULT false;

ALTER TABLE scheme_applications
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS dob DATE,
    ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
    ADD COLUMN IF NOT EXISTS mobile VARCHAR(10),
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS photo_url TEXT,
    ADD COLUMN IF NOT EXISTS category VARCHAR(20) CHECK (category IN ('SC','ST','OBC','EWS','General',NULL)),
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS reviewer_role VARCHAR(10) CHECK (reviewer_role IN ('fpo','officer')),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE TABLE IF NOT EXISTS scheme_application_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES scheme_applications(id) ON DELETE CASCADE,
    doc_type VARCHAR(40) NOT NULL CHECK (doc_type IN
        ('aadhaar','pan','voter_id','driving_licence','passport',
         'electricity_bill','ration_card','caste_certificate',
         'ews_certificate','disability_certificate','minority_certificate')),
    file_url TEXT NOT NULL,
    mime_type VARCHAR(50),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheme_docs_application ON scheme_application_documents(application_id);
