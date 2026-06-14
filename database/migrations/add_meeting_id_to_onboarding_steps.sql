-- Add meeting_id column to existing onboarding_steps table
ALTER TABLE onboarding_steps
    ADD COLUMN IF NOT EXISTS meeting_id TEXT;

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_meeting_id
    ON onboarding_steps (meeting_id);
