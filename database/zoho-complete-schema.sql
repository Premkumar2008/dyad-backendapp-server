-- Complete Zoho Payments schema for Dyad backend
-- Run manually in PostgreSQL, or let the API auto-create on first call.

-- 1. Customers
CREATE TABLE IF NOT EXISTS zoho_customers (
    id                SERIAL PRIMARY KEY,
    user_id           TEXT NOT NULL UNIQUE,
    zoho_customer_id  TEXT NOT NULL,
    name              TEXT NOT NULL,
    email             TEXT NOT NULL,
    phone             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE zoho_customers
    ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_zoho_customers_zoho_customer_id
    ON zoho_customers (zoho_customer_id);

-- 2. Subscriptions
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

-- 3. Payment sessions (widget sessions before payment completes)
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

-- 4. Payments (success and failure ledger)
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

-- 5. Billing events (audit trail)
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
