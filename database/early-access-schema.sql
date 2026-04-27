-- Early Access Requests Table
CREATE TABLE IF NOT EXISTS early_access_requests (
    id              SERIAL PRIMARY KEY,
    practice_name   VARCHAR(255) NOT NULL,
    contact_name    VARCHAR(255) NOT NULL,
    phone_number    VARCHAR(10)  NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    title           VARCHAR(150) NOT NULL,
    practice_type   VARCHAR(100) NOT NULL,
    providers       VARCHAR(50),
    locations       VARCHAR(50),
    claim_volume    VARCHAR(50),
    status          VARCHAR(50)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_early_access_email        ON early_access_requests(email);
CREATE INDEX IF NOT EXISTS idx_early_access_practice_type ON early_access_requests(practice_type);
CREATE INDEX IF NOT EXISTS idx_early_access_status       ON early_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_early_access_created_at   ON early_access_requests(created_at);

-- Auto-update updated_at (reuses the function already defined in schema.sql;
-- create it here only if running this file standalone)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_early_access_updated_at
    BEFORE UPDATE ON early_access_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
