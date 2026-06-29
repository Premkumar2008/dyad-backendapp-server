CREATE TABLE IF NOT EXISTS zoho_payment_sessions (
    id                SERIAL PRIMARY KEY,
    owner_id          TEXT,
    zoho_customer_id  TEXT NOT NULL,
    session_type      VARCHAR(40) NOT NULL
                          CHECK (session_type IN ('payment', 'payment_method')),
    zoho_session_id   TEXT NOT NULL,
    amount            NUMERIC(12, 2),
    currency          VARCHAR(3) NOT NULL DEFAULT 'USD',
    plan              VARCHAR(20),
    status            VARCHAR(30) NOT NULL DEFAULT 'created'
                          CHECK (status IN ('created', 'completed', 'failed', 'expired')),
    failure_reason    TEXT,
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_zoho_payment_sessions_owner_id
    ON zoho_payment_sessions (owner_id);

CREATE INDEX IF NOT EXISTS idx_zoho_payment_sessions_customer_id
    ON zoho_payment_sessions (zoho_customer_id);

CREATE INDEX IF NOT EXISTS idx_zoho_payment_sessions_zoho_session_id
    ON zoho_payment_sessions (zoho_session_id);

CREATE INDEX IF NOT EXISTS idx_zoho_payment_sessions_status
    ON zoho_payment_sessions (status);
