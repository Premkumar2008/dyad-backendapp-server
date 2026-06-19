-- Zoho subscription mandates (saved payment methods for recurring ACH)
CREATE TABLE IF NOT EXISTS zoho_subscriptions (
    id                      SERIAL PRIMARY KEY,
    zoho_customer_id        TEXT NOT NULL,
    zoho_payment_id         TEXT,
    zoho_payment_method_id  TEXT NOT NULL,
    zoho_mandate_id         TEXT,
    plan                    VARCHAR(20) NOT NULL DEFAULT 'monthly'
                                CHECK (plan IN ('monthly', 'yearly')),
    amount                  NUMERIC(12, 2) NOT NULL,
    currency                VARCHAR(3) NOT NULL DEFAULT 'USD',
    mandate_active          BOOLEAN NOT NULL DEFAULT TRUE,
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

CREATE INDEX IF NOT EXISTS idx_zoho_subscriptions_payment_method
    ON zoho_subscriptions (zoho_payment_method_id);

CREATE INDEX IF NOT EXISTS idx_zoho_subscriptions_next_charge
    ON zoho_subscriptions (next_charge)
    WHERE mandate_active = TRUE AND status = 'active';

CREATE OR REPLACE FUNCTION update_zoho_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_zoho_subscriptions_updated_at ON zoho_subscriptions;
CREATE TRIGGER trg_zoho_subscriptions_updated_at
    BEFORE UPDATE ON zoho_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_zoho_subscriptions_updated_at();
