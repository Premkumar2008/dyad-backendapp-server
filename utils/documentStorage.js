import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "text/comma-separated-values",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".xlsx", ".csv"]);

const getUploadRoot = () =>
  process.env.UPLOAD_DIR || path.join(__dirname, "../uploads");

const getS3Client = () => {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) return null;

  return {
    client: new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    }),
    bucket,
  };
};

export const buildStoragePath = (onboardingId, docType, fileName) =>
  `onboarding/${onboardingId}/${docType}/${fileName}`;

export const sanitizeFileName = (originalName) => {
  const baseName = path.basename(originalName || "upload");
  const cleaned = baseName.replace(/[^\w.\-()+\s]/g, "_").trim();
  return cleaned || "upload";
};

export const validateUploadedFile = (file) => {
  if (!file) {
    return null;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File "${file.originalname}" exceeds the 10 MB size limit`);
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(
      `File "${file.originalname}" must be a PDF, XLSX, or CSV file`
    );
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new Error(
      `File "${file.originalname}" has an unsupported content type (${file.mimetype})`
    );
  }

  return file;
};

const getLocalAbsolutePath = (storagePath) =>
  path.join(getUploadRoot(), storagePath);

export const storeFile = async ({ buffer, storagePath, mimeType }) => {
  const s3 = getS3Client();

  if (s3) {
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: storagePath,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    return storagePath;
  }

  const absolutePath = getLocalAbsolutePath(storagePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return storagePath;
};

export const readStoredFile = async (storagePath) => {
  if (!storagePath) {
    throw new Error("storagePath is required");
  }

  const s3 = getS3Client();

  if (s3) {
    const response = await s3.client.send(
      new GetObjectCommand({
        Bucket: s3.bucket,
        Key: storagePath,
      })
    );
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const absolutePath = getLocalAbsolutePath(storagePath);
  return fs.readFile(absolutePath);
};

export const deleteStoredFile = async (storagePath) => {
  if (!storagePath) return;

  const s3 = getS3Client();

  if (s3) {
    await s3.client.send(
      new DeleteObjectCommand({
        Bucket: s3.bucket,
        Key: storagePath,
      })
    );
    return;
  }

  const absolutePath = getLocalAbsolutePath(storagePath);
  await fs.unlink(absolutePath).catch(() => {});
};
