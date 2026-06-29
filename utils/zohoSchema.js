import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA_FILES = [
  "zoho-customers-schema.sql",
  "zoho-subscriptions-schema.sql",
  "zoho-payment-sessions-schema.sql",
  "zoho-payments-schema.sql",
  "zoho-billing-events-schema.sql",
];

let tablesReady = null;

export const ensureAllZohoTables = () => {
  if (!tablesReady) {
    const sql = SCHEMA_FILES.map((file) =>
      fs.readFileSync(path.resolve(__dirname, "../database", file), "utf8")
    ).join("\n");

    tablesReady = pool.query(sql).catch((err) => {
      tablesReady = null;
      console.error("Zoho billing tables setup error:", err);
      throw err;
    });
  }

  return tablesReady;
};
