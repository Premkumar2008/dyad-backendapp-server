import express from "express";
import { apiDocumentationMeta, apiDocumentationSections } from "../utils/apiDocumentationData.js";
import { createApiDocumentationPdf } from "../utils/apiDocumentationPdf.js";

const router = express.Router();

router.get("/api-documentation/metadata", async (req, res) => {
  res.json({
    success: true,
    meta: apiDocumentationMeta,
    sections: apiDocumentationSections.map((section) => ({
      title: section.title,
      description: section.description,
      endpointCount: section.endpoints.length,
    })),
  });
});

router.get("/api-documentation", async (req, res) => {
  try {
    const doc = createApiDocumentationPdf();
    const fileName = `dyad_api_documentation_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error("Error generating API documentation PDF file:", err);
    res.status(500).json({ message: "Error generating API documentation file" });
  }
});

export default router;
