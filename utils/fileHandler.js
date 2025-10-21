const path = require('path');
const { pdfinfo } = require('pdf-poppler');
const EPub = require("node-epub");
const { fileTypeFromBuffer } = require('file-type');

const UPLOAD_DIR = path.join(__dirname, '../uploads');
const ALLOWED_MIMES = ["application/pdf", "application/epub+zip"];

// Validasi tipe file menggunakan magic numbers
const validateFile = async (buffer) => {
  const type = await fileTypeFromBuffer(buffer);
  if (type && ALLOWED_MIMES.includes(type.mime)) {
    return { isValid: true, mime: type.mime };
  }
  return { isValid: false, error: `Invalid file type: ${type ? type.mime : 'unknown'}` };
};

// Ekstrak metadata dari PDF
const extractPdfMetadata = async (filePath) => {
  try {
    const info = await pdfinfo(filePath);
    const pagesMatch = info.match(/Pages:\s*(\d+)/);
    const titleMatch = info.match(/Title:\s*(.+)/);

    return {
      total_pages: pagesMatch ? parseInt(pagesMatch[1], 10) : 0,
      title: titleMatch ? titleMatch[1] : path.basename(filePath)
    };
  } catch (error) {
    console.error("PDF metadata extraction failed:", error);
    // Fallback jika metadata gagal diekstrak
    return { total_pages: 0, title: path.basename(filePath) };
  }
};

// Ekstrak metadata dari EPUB
const extractEpubMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    const epub = new EPub(filePath);
    epub.on("end", () => {
      resolve({
        total_pages: epub.flow.length,
        title: epub.metadata.title || path.basename(filePath)
      });
    });
    epub.on("error", (err) => reject(err));
    epub.parse();
  });
};

module.exports = {
  validateFile,
  extractPdfMetadata,
  extractEpubMetadata,
  UPLOAD_DIR
};