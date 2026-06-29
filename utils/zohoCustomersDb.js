import { pool } from "../config/db.js";
import { ensureAllZohoTables } from "./zohoSchema.js";

export const ensureZohoCustomersTable = () => ensureAllZohoTables();

export const findByUserId = async (userId) => {
  await ensureZohoCustomersTable();

  const result = await pool.query(
    `
      SELECT id, user_id, zoho_customer_id, name, email, phone, created_at
      FROM zoho_customers
      WHERE user_id = $1
      LIMIT 1
    `,
    [String(userId)]
  );

  return result.rows[0] || null;
};

export const insertCustomer = async ({ userId, zohoCustomerId, name, email, phone }) => {
  await ensureZohoCustomersTable();

  const result = await pool.query(
    `
      INSERT INTO zoho_customers (user_id, zoho_customer_id, name, email, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, zoho_customer_id, name, email, phone, created_at
    `,
    [String(userId), zohoCustomerId, name, email, phone || null]
  );

  return result.rows[0];
};
