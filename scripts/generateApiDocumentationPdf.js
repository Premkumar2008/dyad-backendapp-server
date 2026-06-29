import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createApiDocumentationPdf } from "../utils/apiDocumentationPdf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, "../docs/dyad-api-documentation.pdf");

await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

const doc = createApiDocumentationPdf();
const stream = fs.createWriteStream(outputPath);

await new Promise((resolve, reject) => {
  stream.on("finish", resolve);
  stream.on("error", reject);
  doc.on("error", reject);
  doc.pipe(stream);
  doc.end();
});

console.log(`API documentation PDF generated at ${outputPath}`);
