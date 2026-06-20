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
