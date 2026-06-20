import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tableReady = null;

export const ensureZohoCustomersTable = () => {
  if (!tableReady) {
    const schemaPath = path.resolve(__dirname, "../database/zoho-customers-schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf8");
    tableReady = pool.query(sql).catch((err) => {
      tableReady = null;
      console.error("Zoho customers table setup error:", err);
      throw err;
    });
  }
  return tableReady;
};

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
