CREATE TABLE IF NOT EXISTS zoho_payments (
    id                      SERIAL PRIMARY KEY,
    owner_id                TEXT,
    subscription_id         INTEGER REFERENCES zoho_subscriptions (id) ON DELETE SET NULL,
    zoho_customer_id        TEXT,
    zoho_payment_id         TEXT,
    zoho_payment_method_id  TEXT,
    zoho_session_id         TEXT,
    amount                  NUMERIC(12, 2),
    currency                VARCHAR(3) NOT NULL DEFAULT 'USD',
    plan                    VARCHAR(20),
    payment_type            VARCHAR(30) NOT NULL DEFAULT 'initial'
                                CHECK (payment_type IN ('initial', 'recurring', 'verification')),
    status                  VARCHAR(30) NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
    failure_reason          TEXT,
    zoho_status             TEXT,
    metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_zoho_payments_owner_id
    ON zoho_payments (owner_id);

CREATE INDEX IF NOT EXISTS idx_zoho_payments_subscription_id
    ON zoho_payments (subscription_id);

CREATE INDEX IF NOT EXISTS idx_zoho_payments_zoho_payment_id
    ON zoho_payments (zoho_payment_id);

CREATE INDEX IF NOT EXISTS idx_zoho_payments_status
    ON zoho_payments (status);

CREATE INDEX IF NOT EXISTS idx_zoho_payments_created_at
    ON zoho_payments (created_at DESC);
