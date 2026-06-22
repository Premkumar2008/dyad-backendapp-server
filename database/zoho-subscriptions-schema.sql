CREATE TABLE IF NOT EXISTS zoho_subscriptions (
    id                      SERIAL PRIMARY KEY,
    owner_id                TEXT NOT NULL UNIQUE,
    zoho_customer_id        TEXT NOT NULL,
    zoho_payment_id         TEXT,
    zoho_payment_method_id  TEXT NOT NULL,
    plan                    VARCHAR(20) NOT NULL DEFAULT 'monthly'
                                CHECK (plan IN ('monthly', 'yearly')),
    amount                  NUMERIC(12, 2) NOT NULL,
    currency                VARCHAR(3) NOT NULL DEFAULT 'USD',
    status                  VARCHAR(30) NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'past_due', 'cancelled')),
    next_charge             TIMESTAMP NOT NULL,
    last_charged_at         TIMESTAMP,
    last_payment_id         TEXT,
    failure_reason          TEXT,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_zoho_subscriptions_customer
    ON zoho_subscriptions (zoho_customer_id);

CREATE INDEX IF NOT EXISTS idx_zoho_subscriptions_next_charge
    ON zoho_subscriptions (next_charge)
    WHERE status = 'active';
