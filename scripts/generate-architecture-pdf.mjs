import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const inputPath = path.join(rootDir, "docs", "dyad-backend-architecture.md");
const outputPath = path.join(rootDir, "docs", "Dyad-Backend-Architecture.pdf");

const markdown = fs.readFileSync(inputPath, "utf8");
const lines = markdown.split("\n");

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  info: {
    Title: "Dyad Backend Server — Architecture Report",
    Author: "Dyad Practice Solutions",
    Subject: "Application Architecture, Scalability, and Security Analysis",
  },
});

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
let y = doc.page.margins.top;

const ensureSpace = (height = 20) => {
  if (y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }
};

const writeLine = (text, options = {}) => {
  const {
    font = "Helvetica",
    size = 10,
    color = "#222222",
    indent = 0,
    spacing = 4,
  } = options;

  doc.font(font).fontSize(size).fillColor(color);
  const height = doc.heightOfString(text, { width: pageWidth - indent });
  ensureSpace(height + spacing);
  doc.text(text, doc.page.margins.left + indent, y, {
    width: pageWidth - indent,
    lineGap: 2,
  });
  y += height + spacing;
};

for (const rawLine of lines) {
  const line = rawLine.trimEnd();

  if (line === "---") {
    ensureSpace(12);
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .strokeColor("#cccccc")
      .stroke();
    y += 12;
    continue;
  }

  if (!line.trim()) {
    y += 6;
    continue;
  }

  if (line.startsWith("# ")) {
    writeLine(line.slice(2), { font: "Helvetica-Bold", size: 18, color: "#0a2d6e", spacing: 10 });
    continue;
  }

  if (line.startsWith("## ")) {
    writeLine(line.slice(3), { font: "Helvetica-Bold", size: 14, color: "#173e7a", spacing: 8 });
    continue;
  }

  if (line.startsWith("### ")) {
    writeLine(line.slice(4), { font: "Helvetica-Bold", size: 12, color: "#1a4a8a", spacing: 6 });
    continue;
  }

  if (line.startsWith("|") && line.includes("---")) {
    continue;
  }

  if (line.startsWith("|")) {
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
    writeLine(cells.join("  |  "), { size: 9, indent: 8, spacing: 2 });
    continue;
  }

  if (line.startsWith("```")) {
    continue;
  }

  if (line.startsWith("- **")) {
    writeLine(`• ${line.slice(2).replace(/\*\*/g, "")}`, { size: 10, indent: 12, spacing: 3 });
    continue;
  }

  if (line.startsWith("- ")) {
    writeLine(`• ${line.slice(2)}`, { size: 10, indent: 12, spacing: 3 });
    continue;
  }

  if (line.startsWith("**") && line.endsWith("**")) {
    writeLine(line.replace(/\*\*/g, ""), { font: "Helvetica-Bold", size: 10, spacing: 4 });
    continue;
  }

  if (line.startsWith("*") && line.endsWith("*")) {
    writeLine(line.replace(/\*/g, ""), { font: "Helvetica-Oblique", size: 9, color: "#666666", spacing: 6 });
    continue;
  }

  writeLine(line.replace(/\*\*/g, ""), { size: 10, spacing: 4 });
}

doc.end();

stream.on("finish", () => {
  console.log(`PDF generated: ${outputPath}`);
});

stream.on("error", (err) => {
  console.error("PDF generation failed:", err);
  process.exit(1);
});
