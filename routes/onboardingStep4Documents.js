import express from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import {
  buildStoragePath,
  deleteStoredFile,
  MAX_FILE_SIZE_BYTES,
  readStoredFile,
  sanitizeFileName,
  storeFile,
  validateUploadedFile,
} from "../utils/documentStorage.js";
import {
  DOC_TYPES,
  ensureOnboardingDocumentsTable,
  findDocumentByDocumentId,
  findDocumentByOnboardingAndDocumentId,
  findDocumentByType,
  findDocumentsByOnboardingId,
  findOnboardingRecord,
  toDocumentResponse,
  upsertDocument,
} from "../utils/onboardingDocumentsDb.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: DOC_TYPES.length,
  },
});

// Multipart only — do not use express.json() for this route.
const uploadFields = upload.fields([
  { name: "claimsSummary", maxCount: 1 },
  { name: "payerMixReport", maxCount: 1 },
  { name: "arAging", maxCount: 1 },
  { name: "paymentsAdjustments", maxCount: 1 },
  { name: "encounterVolume", maxCount: 1 },
]);

const requireMultipart = (req, res, next) => {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return res.status(400).json({
      success: false,
      message:
        "Content-Type must be multipart/form-data with file fields. JSON bodies are not supported for this endpoint.",
    });
  }
  next();
};

const createDocumentId = () => `doc_${randomBytes(8).toString("hex")}`;

const isValidDocType = (docType) => DOC_TYPES.includes(docType);

const streamDocumentFile = async (res, document) => {
  const fileBuffer = await readStoredFile(document.storage_path);
  const safeFileName = String(document.file_name || "document").replace(/"/g, "'");

  res.setHeader("Content-Type", document.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${safeFileName}"`);
  res.setHeader("Content-Length", fileBuffer.length);
  res.send(fileBuffer);
};

const hasMinimumSubmission = (files, reportAvailabilityNotes) => {
  const uploadedCount = DOC_TYPES.reduce(
    (count, docType) => count + (files?.[docType]?.[0] ? 1 : 0),
    0
  );
  const notes =
    typeof reportAvailabilityNotes === "string"
      ? reportAvailabilityNotes.trim()
      : "";

  return uploadedCount > 0 || notes.length >= 10;
};

const handleMulterError = (err, req, res, next) => {
  if (!err) {
    return next();
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Each file must be 10 MB or smaller",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || "Invalid file upload",
    });
  }

  return res.status(400).json({
    success: false,
    message: err.message || "Invalid file upload",
  });
};

router.post(
  "/onboarding/step/4/documents",
  requireMultipart,
  (req, res, next) => {
    req.setTimeout(120000);
    res.setTimeout(120000);
    next();
  },
  (req, res, next) => {
    uploadFields(req, res, (err) => handleMulterError(err, req, res, next));
  },
  async (req, res) => {
    try {
      await ensureOnboardingDocumentsTable();

      const { onboardingId, reportAvailabilityNotes } = req.body;

      if (!onboardingId || typeof onboardingId !== "string") {
        return res.status(400).json({
          success: false,
          message: "onboardingId is required",
        });
      }

      const onboardingRecord = await findOnboardingRecord(onboardingId);
      if (!onboardingRecord) {
        return res.status(404).json({
          success: false,
          message: "Onboarding record not found. Submit step 1 first.",
        });
      }

      if (!hasMinimumSubmission(req.files, reportAvailabilityNotes)) {
        return res.status(400).json({
          success: false,
          message:
            "Upload at least one report file or provide report availability notes of at least 10 characters",
        });
      }

      for (const docType of DOC_TYPES) {
        const file = req.files?.[docType]?.[0];
        if (!file) {
          continue;
        }

        validateUploadedFile(file);

        const fileName = sanitizeFileName(file.originalname);
        const storagePath = buildStoragePath(onboardingId, docType, fileName);
        const existingDocument = await findDocumentByType(onboardingId, docType);

        if (existingDocument?.storage_path) {
          await deleteStoredFile(existingDocument.storage_path);
        }

        await storeFile({
          buffer: file.buffer,
          storagePath,
          mimeType: file.mimetype || "application/octet-stream",
        });

        await upsertDocument({
          documentId: createDocumentId(),
          onboardingId,
          docType,
          fileName,
          fileSize: file.size,
          mimeType: file.mimetype || "application/octet-stream",
          storagePath,
        });
      }

      const documents = await findDocumentsByOnboardingId(onboardingId);

      res.status(200).json({
        success: true,
        data: {
          onboardingId,
          documents,
        },
      });
    } catch (err) {
      console.error("Upload onboarding step 4 documents error:", err);
      res.status(err.message?.includes("10 MB") || err.message?.includes("must be") ? 400 : 500).json({
        success: false,
        message: err.message || "Failed to upload onboarding documents",
      });
    }
  }
);

router.get(
  "/onboarding/step/4/documents/:onboardingId/:docType/file",
  async (req, res) => {
    try {
      await ensureOnboardingDocumentsTable();

      const { onboardingId, docType } = req.params;

      if (!onboardingId || !docType) {
        return res.status(400).json({
          success: false,
          message: "onboardingId and docType are required",
        });
      }

      if (!isValidDocType(docType)) {
        return res.status(400).json({
          success: false,
          message: `docType must be one of: ${DOC_TYPES.join(", ")}`,
        });
      }

      const onboardingRecord = await findOnboardingRecord(onboardingId);
      if (!onboardingRecord) {
        return res.status(404).json({
          success: false,
          message: "Onboarding record not found",
        });
      }

      const document = await findDocumentByType(onboardingId, docType);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: `No ${docType} document uploaded for this onboarding record`,
        });
      }

      try {
        await streamDocumentFile(res, document);
      } catch {
        return res.status(404).json({
          success: false,
          message: "Document file not found in storage",
        });
      }
    } catch (err) {
      console.error("Stream onboarding step 4 document file error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to stream onboarding document",
      });
    }
  }
);

router.get(
  "/onboarding/step/4/documents/:onboardingId/:documentId",
  async (req, res) => {
    try {
      await ensureOnboardingDocumentsTable();

      const { onboardingId, documentId } = req.params;

      if (!onboardingId || !documentId) {
        return res.status(400).json({
          success: false,
          message: "onboardingId and documentId are required",
        });
      }

      const onboardingRecord = await findOnboardingRecord(onboardingId);
      if (!onboardingRecord) {
        return res.status(404).json({
          success: false,
          message: "Onboarding record not found",
        });
      }

      const document = await findDocumentByOnboardingAndDocumentId(
        onboardingId,
        documentId
      );

      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          onboardingId,
          docType: document.doc_type,
          document: toDocumentResponse(document),
        },
      });
    } catch (err) {
      console.error("Get onboarding step 4 document error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to fetch onboarding document",
      });
    }
  }
);

router.get("/onboarding/step/4/documents/:id", async (req, res) => {
  try {
    await ensureOnboardingDocumentsTable();

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required",
      });
    }

    let onboardingId = id;
    let onboardingRecord = await findOnboardingRecord(id);

    if (!onboardingRecord) {
      const document = await findDocumentByDocumentId(id);
      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Onboarding record not found",
        });
      }

      onboardingId = document.onboarding_id;
      onboardingRecord = await findOnboardingRecord(onboardingId);

      if (!onboardingRecord) {
        return res.status(404).json({
          success: false,
          message: "Onboarding record not found",
        });
      }
    }

    const documents = await findDocumentsByOnboardingId(onboardingId);

    res.status(200).json({
      success: true,
      data: {
        onboardingId,
        documents,
      },
    });
  } catch (err) {
    console.error("Get onboarding step 4 documents error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch onboarding documents",
    });
  }
});

export default router;
