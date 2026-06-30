import { pool } from "../config/db.js";
import { ensureAllZohoTables } from "./zohoSchema.js";

const SUCCESS_STATUSES = new Set(["succeeded", "success", "paid", "captured"]);
const PENDING_STATUSES = new Set([
  "pending",
  "in_progress",
  "processing",
  "initiated",
  "submitted",
]);

export const isZohoPaymentSuccessful = (status) =>
  SUCCESS_STATUSES.has(String(status || "").toLowerCase());

export const isZohoPaymentPending = (status) =>
  PENDING_STATUSES.has(String(status || "").toLowerCase());

export const isZohoPaymentAccepted = (status) =>
  isZohoPaymentSuccessful(status) || isZohoPaymentPending(status);

export const mapZohoPaymentStatus = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (SUCCESS_STATUSES.has(normalized)) {
    return "succeeded";
  }
  if (["failed", "failure", "declined", "cancelled", "canceled"].includes(normalized)) {
    return "failed";
  }
  if (PENDING_STATUSES.has(normalized)) {
    return "pending";
  }
  return "pending";
};

export const insertPaymentRecord = async ({
  ownerId,
  subscriptionId,
  zohoCustomerId,
  zohoPaymentId,
  zohoPaymentMethodId,
  zohoSessionId,
  amount,
  currency = "USD",
  plan,
  paymentType = "initial",
  status,
  failureReason,
  zohoStatus,
  metadata = {},
}) => {
  await ensureAllZohoTables();

  const result = await pool.query(
    `
      INSERT INTO zoho_payments (
        owner_id,
        subscription_id,
        zoho_customer_id,
        zoho_payment_id,
        zoho_payment_method_id,
        zoho_session_id,
        amount,
        currency,
        plan,
        payment_type,
        status,
        failure_reason,
        zoho_status,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
      RETURNING *
    `,
    [
      ownerId ? String(ownerId) : null,
      subscriptionId || null,
      zohoCustomerId || null,
      zohoPaymentId || null,
      zohoPaymentMethodId || null,
      zohoSessionId || null,
      amount ?? null,
      currency,
      plan || null,
      paymentType,
      status,
      failureReason || null,
      zohoStatus || null,
      JSON.stringify(metadata),
    ]
  );

  return result.rows[0];
};

export const findPaymentsByOwnerId = async (ownerId, { limit = 50, offset = 0 } = {}) => {
  await ensureAllZohoTables();

  const result = await pool.query(
    `
      SELECT *
      FROM zoho_payments
      WHERE owner_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3
    `,
    [String(ownerId), limit, offset]
  );

  return result.rows;
};

export const findPaymentByZohoPaymentId = async (zohoPaymentId) => {
  await ensureAllZohoTables();

  const result = await pool.query(
    `
      SELECT *
      FROM zoho_payments
      WHERE zoho_payment_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [zohoPaymentId]
  );

  return result.rows[0] || null;
};
