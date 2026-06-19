import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tableReady = null;

export const ensureZohoSubscriptionsTable = () => {
  if (!tableReady) {
    const schemaPath = path.resolve(__dirname, "../database/zoho-subscriptions-schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");
    tableReady = pool.query(sql).catch((err) => {
      tableReady = null;
      console.error("Zoho subscriptions table setup error:", err);
      throw err;
    });
  }
  return tableReady;
};

export const addMonths = (date, months) => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};

export const addYears = (date, years) => {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
};

export const getNextChargeDate = (plan, fromDate = new Date()) => {
  if (plan === "yearly") {
    return addYears(fromDate, 1);
  }
  return addMonths(fromDate, 1);
};

export const insertSubscription = async ({
  zoho_customer_id,
  zoho_payment_id,
  zoho_payment_method_id,
  zoho_mandate_id,
  plan = "monthly",
  amount,
  currency = "USD",
  next_charge,
}) => {
  await ensureZohoSubscriptionsTable();

  const result = await pool.query(
    `
      INSERT INTO zoho_subscriptions (
        zoho_customer_id,
        zoho_payment_id,
        zoho_payment_method_id,
        zoho_mandate_id,
        plan,
        amount,
        currency,
        mandate_active,
        status,
        next_charge
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 'active', $8)
      RETURNING *
    `,
    [
      zoho_customer_id,
      zoho_payment_id || null,
      zoho_payment_method_id,
      zoho_mandate_id || null,
      plan,
      amount,
      currency,
      next_charge,
    ]
  );

  return result.rows[0];
};

export const findDueSubscriptions = async (asOf = new Date()) => {
  await ensureZohoSubscriptionsTable();

  const result = await pool.query(
    `
      SELECT *
      FROM zoho_subscriptions
      WHERE mandate_active = TRUE
        AND status = 'active'
        AND next_charge <= $1
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
      SET
        last_charged_at = CURRENT_TIMESTAMP,
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
      SET
        status = 'past_due',
        failure_reason = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [id, failureReason]
  );

  return result.rows[0];
};

export const getSubscriptionByCustomerId = async (zohoCustomerId) => {
  await ensureZohoSubscriptionsTable();

  const result = await pool.query(
    `
      SELECT *
      FROM zoho_subscriptions
      WHERE zoho_customer_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [zohoCustomerId]
  );

  return result.rows[0] || null;
};
