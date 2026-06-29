import { pool } from "../config/db.js";
import { ensureAllZohoTables } from "./zohoSchema.js";

export const insertBillingEvent = async ({
  ownerId,
  subscriptionId,
  paymentId,
  eventType,
  message,
  payload = {},
}) => {
  await ensureAllZohoTables();

  const result = await pool.query(
    `
      INSERT INTO zoho_billing_events (
        owner_id,
        subscription_id,
        payment_id,
        event_type,
        message,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING *
    `,
    [
      ownerId ? String(ownerId) : null,
      subscriptionId || null,
      paymentId || null,
      eventType,
      message || null,
      JSON.stringify(payload),
    ]
  );

  return result.rows[0];
};

export const findBillingEventsByOwnerId = async (
  ownerId,
  { limit = 100, offset = 0 } = {}
) => {
  await ensureAllZohoTables();

  const result = await pool.query(
    `
      SELECT *
      FROM zoho_billing_events
      WHERE owner_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3
    `,
    [String(ownerId), limit, offset]
  );

  return result.rows;
};
