import PDFDocument from "pdfkit";
import { apiDocumentationMeta, apiDocumentationSections } from "./apiDocumentationData.js";

const PAGE_MARGIN = 48;
const CONTENT_WIDTH = 515;

const stringify = (value) => {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
};

const renderKeyValueList = (doc, title, items) => {
  if (!items || items.length === 0) {
    return;
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#0f172a")
    .text(title, { width: CONTENT_WIDTH });

  items.forEach((item) => {
    const label = `${item.name}${item.required ? " (required)" : ""}`;
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#111827")
      .text(`- ${label}: `, { continued: true });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#374151")
      .text(item.description || item.value || "", {
        width: CONTENT_WIDTH,
      });
  });

  doc.moveDown(0.5);
};

const renderCodeBlock = (doc, title, value) => {
  if (value === undefined || value === null) {
    return;
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#0f172a")
    .text(title, { width: CONTENT_WIDTH });

  const text = stringify(value);
  const x = doc.x;
  const y = doc.y;
  const height = doc.heightOfString(text, {
    width: CONTENT_WIDTH - 24,
    align: "left",
  }) + 18;

  doc
    .roundedRect(x, y, CONTENT_WIDTH, height, 6)
    .fillAndStroke("#f8fafc", "#cbd5e1");

  doc
    .fillColor("#111827")
    .font("Courier")
    .fontSize(8.5)
    .text(text, x + 12, y + 9, {
      width: CONTENT_WIDTH - 24,
      align: "left",
    });

  doc.moveDown(1.4);
  doc.x = PAGE_MARGIN;
};

const renderResponse = (doc, response) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor("#0f766e")
    .text(`Response ${response.status}`, { continued: true });

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#374151")
    .text(` - ${response.description}`, { width: CONTENT_WIDTH });

  renderCodeBlock(doc, "Example body", response.body);
};

const ensurePageSpace = (doc, minSpace = 120) => {
  if (doc.y > doc.page.height - doc.page.margins.bottom - minSpace) {
    doc.addPage();
  }
};

export const createApiDocumentationPdf = () => {
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
  });

  doc.info.Title = apiDocumentationMeta.title;
  doc.info.Author = "Cursor";
  doc.info.Subject = "Dyad backend API reference";

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#0f172a")
    .text(apiDocumentationMeta.title, { width: CONTENT_WIDTH });

  doc
    .moveDown(0.3)
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#475569")
    .text(`Version: ${apiDocumentationMeta.version}`, { width: CONTENT_WIDTH })
    .text(`Base path: ${apiDocumentationMeta.baseUrl}`, { width: CONTENT_WIDTH })
    .text(`Generated at: ${new Date().toISOString()}`, { width: CONTENT_WIDTH });

  doc.moveDown(0.7);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#0f172a")
    .text("Notes", { width: CONTENT_WIDTH });

  apiDocumentationMeta.notes.forEach((note) => {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#334155")
      .text(`- ${note}`, { width: CONTENT_WIDTH });
  });

  apiDocumentationSections.forEach((section) => {
    ensurePageSpace(doc, 140);
    doc.moveDown(1);
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#111827")
      .text(section.title, { width: CONTENT_WIDTH });

    if (section.description) {
      doc
        .moveDown(0.25)
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#475569")
        .text(section.description, { width: CONTENT_WIDTH });
    }

    section.endpoints.forEach((endpoint) => {
      ensurePageSpace(doc, 200);
      doc.moveDown(0.8);

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#0f172a")
        .text(`${endpoint.method} ${endpoint.path}`, { width: CONTENT_WIDTH });

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#374151")
        .text(endpoint.summary, { width: CONTENT_WIDTH });

      doc
        .moveDown(0.15)
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#111827")
        .text("Authentication: ", { continued: true });

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#374151")
        .text(endpoint.auth || "Public", { width: CONTENT_WIDTH });

      if (endpoint.request?.description) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#475569")
          .text(endpoint.request.description, { width: CONTENT_WIDTH });
      }

      renderKeyValueList(doc, "Headers", endpoint.request?.headers);
      renderKeyValueList(doc, "Path parameters", endpoint.request?.pathParams);
      renderKeyValueList(doc, "Query parameters", endpoint.request?.query);
      renderCodeBlock(doc, "Example request body", endpoint.request?.body);

      (endpoint.responses || []).forEach((response) => {
        ensurePageSpace(doc, 140);
        renderResponse(doc, response);
      });
    });
  });

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        `Page ${i + 1} of ${range.count}`,
        PAGE_MARGIN,
        doc.page.height - 30,
        { align: "center", width: doc.page.width - PAGE_MARGIN * 2 }
      );
  }

  return doc;
};
