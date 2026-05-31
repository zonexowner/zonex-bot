const Tesseract = require("tesseract.js");
const { buildOcrVariants } = require("./preprocess");

let workerPromise = null;

const getWorker = async () => {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng+deu", 1, {
      logger: () => {},
    });
  }
  return workerPromise;
};

const ocrImage = async (filePath) => {
  const worker = await getWorker();
  const { data } = await worker.recognize(filePath);
  return String(data.text || "").trim();
};

const ocrMultiPass = async (filePath, options = {}) => {
  const variants = await buildOcrVariants(filePath, options);
  const parts = [];
  for (const variant of variants) {
    const text = await ocrImage(variant);
    if (text) parts.push(text);
  }
  return [...new Set(parts)].join("\n---\n");
};

module.exports = { ocrImage, ocrMultiPass };
