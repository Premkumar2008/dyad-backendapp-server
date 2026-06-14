-- Calls Scheduled Admin Table
CREATE TABLE IF NOT EXISTS calls_scheduled_admin (
    id                SERIAL PRIMARY KEY,
    email             VARCHAR(255) NOT NULL,
    contact_name      VARCHAR(255) NOT NULL,
    event_title       VARCHAR(255) NOT NULL,
    email_subject     VARCHAR(500) NOT NULL,
    call_type         VARCHAR(100) NOT NULL,
    mail_description  TEXT,
    scheduled_at      TIMESTAMP NOT NULL,
    meeting_id        TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calls_scheduled_admin_email
    ON calls_scheduled_admin (email);

CREATE INDEX IF NOT EXISTS idx_calls_scheduled_admin_meeting_id
    ON calls_scheduled_admin (meeting_id);

CREATE INDEX IF NOT EXISTS idx_calls_scheduled_admin_scheduled_at
    ON calls_scheduled_admin (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_calls_scheduled_admin_call_type
    ON calls_scheduled_admin (call_type);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_calls_scheduled_admin_updated_at
    BEFORE UPDATE ON calls_scheduled_admin
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
