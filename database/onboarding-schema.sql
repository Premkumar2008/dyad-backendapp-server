-- Onboarding Steps Table
CREATE TABLE IF NOT EXISTS onboarding_steps (
    id              SERIAL PRIMARY KEY,
    onboarding_id   TEXT NOT NULL,
    step            INTEGER NOT NULL DEFAULT 1
                        CHECK (step BETWEEN 1 AND 6),
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    step_1_payload  JSONB,
    step_2_payload  JSONB,
    step_3_payload  JSONB,
    step_4_payload  JSONB,
    step_5_payload  JSONB,
    step_6_payload  JSONB,
    npi             TEXT,
    contact_email   TEXT,
    contact_name    TEXT,
    call_event_id   TEXT,
    meeting_id      TEXT,
    status          TEXT NOT NULL DEFAULT 'Onboarding',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (onboarding_id, step)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_onboarding_id
    ON onboarding_steps (onboarding_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_npi
    ON onboarding_steps (npi);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_call_event_id
    ON onboarding_steps (call_event_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_meeting_id
    ON onboarding_steps (meeting_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_steps_contact_email_unique
    ON onboarding_steps (LOWER(contact_email))
    WHERE contact_email IS NOT NULL;

-- Auto-update updated_at (reuses the function already defined in schema.sql;
-- create it here only if running this file standalone)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_onboarding_steps_updated_at
    BEFORE UPDATE ON onboarding_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
