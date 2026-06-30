import { pool } from "../config/db.js";
import { ensureAllZohoTables } from "./zohoSchema.js";

export const insertPaymentSession = async ({
  ownerId,
  zohoCustomerId,
  sessionType,
  zohoSessionId,
  amount,
  currency = "USD",
  plan,
  metadata = {},
}) => {
  await ensureAllZohoTables();

  const result = await pool.query(
    `
      INSERT INTO zoho_payment_sessions (
        owner_id,
        zoho_customer_id,
        session_type,
        zoho_session_id,
        amount,
        currency,
        plan,
        status,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'created', $8::jsonb)
      RETURNING *
    `,
    [
      ownerId ? String(ownerId) : null,
      zohoCustomerId,
      sessionType,
      zohoSessionId,
      amount ?? null,
      currency,
      plan || null,
      JSON.stringify(metadata),
    ]
  );

  return result.rows[0];
};

export const updatePaymentSessionStatus = async (
  zohoSessionId,
  { status, failureReason, metadata = null }
) => {
  await ensureAllZohoTables();

  const result = await pool.query(
    `
      UPDATE zoho_payment_sessions
      SET
        status = $2,
        failure_reason = COALESCE($3, failure_reason),
        metadata = CASE
          WHEN $4::jsonb IS NULL THEN metadata
          ELSE metadata || $4::jsonb
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE zoho_session_id = $1
      RETURNING *
    `,
    [
      zohoSessionId,
      status,
      failureReason || null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );

  return result.rows[0] || null;
};

export const findPaymentSessionByZohoSessionId = async (zohoSessionId) => {
  await ensureAllZohoTables();

  const result = await pool.query(
    `
      SELECT *
      FROM zoho_payment_sessions
      WHERE zoho_session_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [zohoSessionId]
  );

  return result.rows[0] || null;
};

export const findPaymentSessionsByOwnerId = async (
  ownerId,
  { limit = 50, offset = 0 } = {}
) => {
  await ensureAllZohoTables();

  const result = await pool.query(
    `
      SELECT *
      FROM zoho_payment_sessions
      WHERE owner_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3
    `,
    [String(ownerId), limit, offset]
  );

  return result.rows;
};
