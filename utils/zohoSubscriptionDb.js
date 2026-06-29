import { pool } from "../config/db.js";
import { ensureAllZohoTables } from "./zohoSchema.js";

export const ensureZohoSubscriptionsTable = () => ensureAllZohoTables();

export const getNextChargeDate = (plan, fromDate = new Date()) => {
  const next = new Date(fromDate);
  if (plan === "yearly") {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
};

export const findSubscriptionByOwnerId = async (ownerId) => {
  await ensureZohoSubscriptionsTable();
  const result = await pool.query(
    `SELECT * FROM zoho_subscriptions WHERE owner_id = $1 LIMIT 1`,
    [String(ownerId)]
  );
  return result.rows[0] || null;
};

export const insertSubscription = async ({
  ownerId,
  zohoCustomerId,
  zohoPaymentId,
  zohoPaymentMethodId,
  plan,
  amount,
  currency,
  nextCharge,
}) => {
  await ensureZohoSubscriptionsTable();
  const result = await pool.query(
    `
      INSERT INTO zoho_subscriptions (
        owner_id, zoho_customer_id, zoho_payment_id, zoho_payment_method_id,
        plan, amount, currency, status, next_charge
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
      RETURNING *
    `,
    [
      String(ownerId),
      zohoCustomerId,
      zohoPaymentId || null,
      zohoPaymentMethodId,
      plan,
      amount,
      currency,
      nextCharge,
    ]
  );
  return result.rows[0];
};

export const findDueSubscriptions = async (asOf = new Date()) => {
  await ensureZohoSubscriptionsTable();
  const result = await pool.query(
    `
      SELECT * FROM zoho_subscriptions
      WHERE status = 'active' AND next_charge <= $1
      ORDER BY next_charge ASC
    `,
    [asOf]
  );
  return result.rows;
};

export const markSubscriptionCharged = async (id, { paymentId, nextCharge }) => {
  const result = await pool.query(
    `
      UPDATE zoho_subscriptions
      SET last_charged_at = CURRENT_TIMESTAMP,
          last_payment_id = $2,
          next_charge = $3,
          failure_reason = NULL,
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [id, paymentId || null, nextCharge]
  );
  return result.rows[0];
};

export const markSubscriptionFailed = async (id, failureReason) => {
  const result = await pool.query(
    `
      UPDATE zoho_subscriptions
      SET status = 'past_due',
          failure_reason = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [id, failureReason]
  );
  return result.rows[0];
};
