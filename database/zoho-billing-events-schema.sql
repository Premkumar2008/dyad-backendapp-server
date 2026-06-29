CREATE TABLE IF NOT EXISTS zoho_billing_events (
    id                SERIAL PRIMARY KEY,
    owner_id          TEXT,
    subscription_id   INTEGER REFERENCES zoho_subscriptions (id) ON DELETE SET NULL,
    payment_id        INTEGER REFERENCES zoho_payments (id) ON DELETE SET NULL,
    event_type        VARCHAR(50) NOT NULL,
    message           TEXT,
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_zoho_billing_events_owner_id
    ON zoho_billing_events (owner_id);

CREATE INDEX IF NOT EXISTS idx_zoho_billing_events_subscription_id
    ON zoho_billing_events (subscription_id);

CREATE INDEX IF NOT EXISTS idx_zoho_billing_events_event_type
    ON zoho_billing_events (event_type);

CREATE INDEX IF NOT EXISTS idx_zoho_billing_events_created_at
    ON zoho_billing_events (created_at DESC);
