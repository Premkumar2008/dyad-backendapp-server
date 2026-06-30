import { pool } from "../config/db.js";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "../database/onboarding-documents-schema.sql");

let tableReady;

export const DOC_TYPES = [
  "claimsSummary",
  "payerMixReport",
  "arAging",
  "paymentsAdjustments",
  "encounterVolume",
];

export const ensureOnboardingDocumentsTable = () => {
  if (!tableReady) {
    tableReady = readFile(schemaPath, "utf8")
      .then((sql) => pool.query(sql))
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
};

const toDocumentResponse = (row) =>
  row
    ? {
        documentId: row.document_id,
        fileName: row.file_name,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        storagePath: row.storage_path,
        uploadedAt:
          row.uploaded_at instanceof Date
            ? row.uploaded_at.toISOString()
            : row.uploaded_at,
      }
    : null;

export const findOnboardingRecord = async (onboardingId) => {
  const result = await pool.query(
    `
      SELECT id, onboarding_id, contact_email
      FROM onboarding_steps
      WHERE onboarding_id = $1
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `,
    [onboardingId]
  );

  return result.rows[0] || null;
};

export const findDocumentsByOnboardingId = async (onboardingId) => {
  await ensureOnboardingDocumentsTable();

  const result = await pool.query(
    `
      SELECT *
      FROM onboarding_documents
      WHERE onboarding_id = $1
      ORDER BY uploaded_at DESC, id DESC
    `,
    [onboardingId]
  );

  const documents = Object.fromEntries(DOC_TYPES.map((docType) => [docType, null]));
  for (const row of result.rows) {
    if (!documents[row.doc_type]) {
      documents[row.doc_type] = toDocumentResponse(row);
    }
  }

  return documents;
};

export const findDocumentByDocumentId = async (documentId) => {
  await ensureOnboardingDocumentsTable();

  const result = await pool.query(
    `
      SELECT *
      FROM onboarding_documents
      WHERE document_id = $1
      LIMIT 1
    `,
    [documentId]
  );

  return result.rows[0] || null;
};

export const findDocumentByOnboardingAndDocumentId = async (
  onboardingId,
  documentId
) => {
  await ensureOnboardingDocumentsTable();

  const result = await pool.query(
    `
      SELECT *
      FROM onboarding_documents
      WHERE onboarding_id = $1 AND document_id = $2
      LIMIT 1
    `,
    [onboardingId, documentId]
  );

  return result.rows[0] || null;
};

export const findDocumentByType = async (onboardingId, docType) => {
  await ensureOnboardingDocumentsTable();

  const result = await pool.query(
    `
      SELECT *
      FROM onboarding_documents
      WHERE onboarding_id = $1 AND doc_type = $2
      LIMIT 1
    `,
    [onboardingId, docType]
  );

  return result.rows[0] || null;
};

export const upsertDocument = async ({
  documentId,
  onboardingId,
  docType,
  fileName,
  fileSize,
  mimeType,
  storagePath,
}) => {
  await ensureOnboardingDocumentsTable();

  const result = await pool.query(
    `
      INSERT INTO onboarding_documents (
        document_id,
        onboarding_id,
        doc_type,
        file_name,
        file_size,
        mime_type,
        storage_path
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (onboarding_id, doc_type)
      DO UPDATE SET
        document_id = EXCLUDED.document_id,
        file_name = EXCLUDED.file_name,
        file_size = EXCLUDED.file_size,
        mime_type = EXCLUDED.mime_type,
        storage_path = EXCLUDED.storage_path,
        uploaded_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [documentId, onboardingId, docType, fileName, fileSize, mimeType, storagePath]
  );

  return result.rows[0];
};

export { toDocumentResponse };
