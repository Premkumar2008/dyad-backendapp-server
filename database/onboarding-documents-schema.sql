CREATE TABLE IF NOT EXISTS onboarding_documents (
    id              SERIAL PRIMARY KEY,
    document_id     TEXT NOT NULL UNIQUE,
    onboarding_id   TEXT NOT NULL,
    doc_type        TEXT NOT NULL
                        CHECK (doc_type IN (
                            'claimsSummary',
                            'payerMixReport',
                            'arAging',
                            'paymentsAdjustments',
                            'encounterVolume'
                        )),
    file_name       TEXT NOT NULL,
    file_size       INTEGER NOT NULL,
    mime_type       TEXT NOT NULL,
    storage_path    TEXT NOT NULL,
    uploaded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (onboarding_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_documents_onboarding_id
    ON onboarding_documents (onboarding_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_documents_document_id
    ON onboarding_documents (document_id);
