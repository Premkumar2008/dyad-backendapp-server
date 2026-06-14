import express from "express";
import { randomUUID } from "crypto";
import { pool } from "../config/db.js";
import { buildMeetingLinkFromId } from "../utils/meetingLink.js";

const router = express.Router();
const MIN_STEP = 1;
const MAX_STEP = 6;

const createOnboardingTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onboarding_steps (
      id SERIAL PRIMARY KEY,
      onboarding_id TEXT NOT NULL,
      step INTEGER NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 6),
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      step_1_payload JSONB,
      step_2_payload JSONB,
      step_3_payload JSONB,
      step_4_payload JSONB,
      step_5_payload JSONB,
      step_6_payload JSONB,
      npi TEXT,
      contact_email TEXT,
      contact_name TEXT,
      call_event_id TEXT,
      meeting_id TEXT,
      status TEXT NOT NULL DEFAULT 'Onboarding',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (onboarding_id, step)
    );

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

    ALTER TABLE onboarding_steps
      ADD COLUMN IF NOT EXISTS step_1_payload JSONB,
      ADD COLUMN IF NOT EXISTS step_2_payload JSONB,
      ADD COLUMN IF NOT EXISTS step_3_payload JSONB,
      ADD COLUMN IF NOT EXISTS step_4_payload JSONB,
      ADD COLUMN IF NOT EXISTS step_5_payload JSONB,
      ADD COLUMN IF NOT EXISTS step_6_payload JSONB,
      ADD COLUMN IF NOT EXISTS meeting_id TEXT;

    UPDATE onboarding_steps SET step_1_payload = payload WHERE step = 1 AND step_1_payload IS NULL;
    UPDATE onboarding_steps SET step_2_payload = payload WHERE step = 2 AND step_2_payload IS NULL;
    UPDATE onboarding_steps SET step_3_payload = payload WHERE step = 3 AND step_3_payload IS NULL;
    UPDATE onboarding_steps SET step_4_payload = payload WHERE step = 4 AND step_4_payload IS NULL;
    UPDATE onboarding_steps SET step_5_payload = payload WHERE step = 5 AND step_5_payload IS NULL;
    UPDATE onboarding_steps SET step_6_payload = payload WHERE step = 6 AND step_6_payload IS NULL;

    ALTER TABLE onboarding_steps
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Onboarding';

    ALTER TABLE onboarding_steps
      ALTER COLUMN status SET DEFAULT 'Onboarding';

    UPDATE onboarding_steps
    SET status = 'Onboarding'
    WHERE status = 'in_progress';

    UPDATE onboarding_steps
    SET status = 'Active'
    WHERE step_1_payload IS NOT NULL
      AND step_2_payload IS NOT NULL
      AND step_3_payload IS NOT NULL
      AND step_4_payload IS NOT NULL
      AND step_5_payload IS NOT NULL
      AND step_6_payload IS NOT NULL
      AND status <> 'Active';
  `);
};

const tableReady = createOnboardingTable().catch((err) => {
  console.error("Onboarding steps table setup error:", err);
});

const getStepNumber = (stepParam) => {
  const step = Number(stepParam);
  return Number.isInteger(step) ? step : null;
};

const normalizeEmail = (email) =>
  typeof email === "string" ? email.toLowerCase().trim() : null;

const getIdentifierFields = (payload) => ({
  npi: payload.npi || payload.npiApiData?.npi || null,
  contactEmail: normalizeEmail(
    payload.contactEmail ||
      payload.callerEmail ||
      payload.email ||
      payload.npiApiData?.email
  ),
  contactName:
    payload.contactName ||
    payload.callerName ||
    payload.npiApiData?.contactName ||
    payload.npiApiData?.fullName ||
    null,
  callEventId: payload.callEventId || null,
  meetingId: payload.meetingId || payload.meeting_id || null,
});

const getPayloadOnboardingId = (payload) =>
  payload.onboardingId || payload.onboarding_id || payload.submissionId || null;

const getStepPayloadColumn = (step) => `step_${step}_payload`;

const enrichOnboardingRecord = (record) => ({
  ...record,
  meetingLink: buildMeetingLinkFromId(record.meeting_id),
});

const getCompletedSteps = (row) =>
  Array.from({ length: MAX_STEP }, (_, index) => index + 1).filter(
    (step) => row[getStepPayloadColumn(step)] !== null
  );

const isOnboardingComplete = (row) =>
  getCompletedSteps(row).length === MAX_STEP;

const activateOnboardingIfComplete = async (record) => {
  if (!isOnboardingComplete(record) || record.status === "Active") {
    return record;
  }

  const result = await pool.query(
    `
      UPDATE onboarding_steps
      SET status = 'Active', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [record.id]
  );

  return result.rows[0] || record;
};

const findExistingOnboardingId = async ({
  npi,
  contactEmail,
  callEventId,
  meetingId,
}) => {
  if (!npi && !contactEmail && !callEventId && !meetingId) {
    return null;
  }

  const conditions = [];
  const values = [];

  if (npi) {
    values.push(npi);
    conditions.push(`npi = $${values.length}`);
  }

  if (contactEmail) {
    values.push(contactEmail);
    conditions.push(`LOWER(contact_email) = LOWER($${values.length})`);
  }

  if (callEventId) {
    values.push(callEventId);
    conditions.push(`call_event_id = $${values.length}`);
  }

  if (meetingId) {
    values.push(meetingId);
    conditions.push(`meeting_id = $${values.length}`);
  }

  const result = await pool.query(
    `
      SELECT onboarding_id
      FROM onboarding_steps
      WHERE ${conditions.join(" OR ")}
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    values
  );

  return result.rows[0]?.onboarding_id || null;
};

router.post("/onboarding/check-email", async (req, res) => {
  try {
    await tableReady;

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        exists: null,
        message: "Email address is required",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        exists: null,
        message: "Please provide a valid email address",
      });
    }

    const result = await pool.query(
      `
        SELECT onboarding_id, status, created_at, updated_at
        FROM onboarding_steps
        WHERE LOWER(contact_email) = $1
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (result.rows.length > 0) {
      const { onboarding_id, status, created_at, updated_at } = result.rows[0];
      return res.status(200).json({
        success: true,
        exists: true,
        onboardingId: onboarding_id,
        status,
        message: `This email is already registered for onboarding (status: ${status}).`,
        submittedAt: created_at,
        updatedAt: updated_at,
      });
    }

    return res.status(200).json({
      success: true,
      exists: false,
      onboardingId: null,
      message: "This email is not yet registered. You can continue onboarding.",
    });
  } catch (err) {
    console.error("Onboarding check-email error:", err);
    res.status(500).json({
      success: false,
      exists: null,
      message: "Unable to verify email at this time. Please try again later.",
    });
  }
});

router.post("/onboarding/step/:step", async (req, res) => {
  try {
    await tableReady;

    const step = getStepNumber(req.params.step);
    if (!step || step < MIN_STEP || step > MAX_STEP) {
      return res.status(400).json({
        success: false,
        message: "Invalid onboarding step. Step must be between 1 and 6.",
      });
    }

    const payload = req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({
        success: false,
        message: "Request body must be a JSON object.",
      });
    }

    const identifiers = getIdentifierFields(payload);
    const requestedOnboardingId = getPayloadOnboardingId(payload);
    const existingOnboardingId =
      requestedOnboardingId || (step > 1 ? await findExistingOnboardingId(identifiers) : null);
    const onboardingId = step === 1 ? requestedOnboardingId || randomUUID() : existingOnboardingId;
    const stepPayloadColumn = getStepPayloadColumn(step);

    if (step > 1 && !onboardingId) {
      return res.status(400).json({
        success: false,
        message:
          "onboardingId is required for steps 2-6. Submit step 1 first and pass the returned onboardingId.",
      });
    }

    let result;

    if (step === 1) {
      result = await pool.query(
        `
          INSERT INTO onboarding_steps (
            onboarding_id,
            step,
            payload,
            step_1_payload,
            npi,
            contact_email,
            contact_name,
            call_event_id,
            meeting_id,
            updated_at
          )
          VALUES ($1, 1, $2::jsonb, $2::jsonb, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          RETURNING *
        `,
        [
          onboardingId,
          JSON.stringify(payload),
          identifiers.npi,
          identifiers.contactEmail,
          identifiers.contactName,
          identifiers.callEventId,
          identifiers.meetingId,
        ]
      );
    } else {
      result = await pool.query(
        `
          UPDATE onboarding_steps
          SET
            ${stepPayloadColumn} = $2::jsonb,
            npi = COALESCE($3, npi),
            contact_email = COALESCE($4, contact_email),
            contact_name = COALESCE($5, contact_name),
            call_event_id = COALESCE($6, call_event_id),
            meeting_id = COALESCE($7, meeting_id),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = (
            SELECT id
            FROM onboarding_steps
            WHERE onboarding_id = $1
            ORDER BY created_at ASC, id ASC
            LIMIT 1
          )
          RETURNING *
        `,
        [
          onboardingId,
          JSON.stringify(payload),
          identifiers.npi,
          identifiers.contactEmail,
          identifiers.contactName,
          identifiers.callEventId,
          identifiers.meetingId,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Onboarding record not found. Submit step 1 first.",
          onboardingId,
        });
      }
    }

    const savedRecord = await activateOnboardingIfComplete(result.rows[0]);

    const enrichedRecord = enrichOnboardingRecord(savedRecord);

    res.status(200).json({
      success: true,
      message: `Onboarding step ${step} saved successfully`,
      onboardingId,
      status: enrichedRecord.status,
      meetingId: enrichedRecord.meeting_id,
      meetingLink: enrichedRecord.meetingLink,
      completedSteps: getCompletedSteps(savedRecord),
      data: enrichedRecord,
    });
  } catch (err) {
    console.error("Save onboarding step error:", err);

    if (err.code === "23505" && err.constraint?.includes("contact_email")) {
      return res.status(409).json({
        success: false,
        message: "This contact email is already registered for onboarding.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to save onboarding step",
    });
  }
});

router.get("/onboarding", async (_req, res) => {
  try {
    await tableReady;

    const result = await pool.query(
      `
        SELECT *
        FROM onboarding_steps
        ORDER BY created_at DESC, id DESC
      `
    );

    const data = result.rows.map((record) => ({
      ...enrichOnboardingRecord(record),
      completedSteps: getCompletedSteps(record),
    }));

    res.status(200).json({
      success: true,
      total: data.length,
      data,
    });
  } catch (err) {
    console.error("Get all onboarding steps error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch onboarding records",
    });
  }
});

router.get("/onboarding/:onboardingId", async (req, res) => {
  try {
    await tableReady;

    const { onboardingId } = req.params;
    const result = await pool.query(
      `
        SELECT *
        FROM onboarding_steps
        WHERE onboarding_id = $1
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
      [onboardingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Onboarding record not found",
      });
    }

    const record = enrichOnboardingRecord(result.rows[0]);

    res.json({
      success: true,
      onboardingId,
      meetingId: record.meeting_id,
      meetingLink: record.meetingLink,
      completedSteps: getCompletedSteps(result.rows[0]),
      data: record,
    });
  } catch (err) {
    console.error("Get onboarding steps error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve onboarding steps",
    });
  }
});

router.get("/onboarding/:onboardingId/step/:step", async (req, res) => {
  try {
    await tableReady;

    const step = getStepNumber(req.params.step);
    if (!step || step < MIN_STEP || step > MAX_STEP) {
      return res.status(400).json({
        success: false,
        message: "Invalid onboarding step. Step must be between 1 and 6.",
      });
    }

    const { onboardingId } = req.params;
    const stepPayloadColumn = getStepPayloadColumn(step);
    const result = await pool.query(
      `
        SELECT ${stepPayloadColumn} AS payload, id, onboarding_id, npi, contact_email, contact_name, call_event_id, meeting_id, status, created_at, updated_at
        FROM onboarding_steps
        WHERE onboarding_id = $1
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
      [onboardingId]
    );

    if (result.rows.length === 0 || result.rows[0].payload === null) {
      return res.status(404).json({
        success: false,
        message: "Onboarding step not found",
      });
    }

    const record = enrichOnboardingRecord(result.rows[0]);

    res.json({
      success: true,
      onboardingId,
      step,
      meetingId: record.meeting_id,
      meetingLink: record.meetingLink,
      data: record,
    });
  } catch (err) {
    console.error("Get onboarding step error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve onboarding step",
    });
  }
});

export default router;
