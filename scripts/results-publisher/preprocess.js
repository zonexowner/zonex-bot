const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const config = require("./config");

const preprocessedDir = path.join(config.dataDir, "preprocessed");

const ensureDir = () => fs.mkdirSync(preprocessedDir, { recursive: true });

const writeVariant = async (buffer, name) => {
  ensureDir();
  const out = path.join(preprocessedDir, name);
  await sharp(buffer).png().toFile(out);
  return out;
};

const enhance = (pipeline) =>
  pipeline
    .grayscale()
    .normalize()
    .sharpen()
    .linear(1.15, -12);

/**
 * Build several OCR-friendly crops from one upload.
 * Telegram chat + embedded MT5 phone screenshot is the hard case.
 */
const buildOcrVariants = async (filePath, options = {}) => {
  const { fast = false } = options;
  ensureDir();
  const base = sharp(filePath);
  const meta = await base.metadata();
  const width = meta.width || 1080;
  const height = meta.height || 1920;

  const variants = [];
  const stem = path.basename(filePath, path.extname(filePath));

  // Full image, upscaled 2x for small text
  const full2x = await enhance(sharp(filePath).resize(width * 2, height * 2, { fit: "fill" })).png().toBuffer();
  variants.push(await writeVariant(full2x, `${stem}-full2x.png`));

  if (fast) {
    // Batch mode: profit numbers usually in bottom strip
    const stripHeight = Math.floor(height * 0.22);
    const stripTop = Math.max(0, height - stripHeight - Math.floor(height * 0.08));
    const bottomStrip = await enhance(
      sharp(filePath)
        .extract({ left: 0, top: stripTop, width, height: Math.min(stripHeight, height - stripTop) })
        .resize(width * 2, stripHeight * 2)
    )
      .png()
      .toBuffer();
    variants.push(await writeVariant(bottomStrip, `${stem}-bottom.png`));
    return variants;
  }

  // Center band — embedded phone screenshot in Telegram chats
  const centerTop = Math.floor(height * 0.18);
  const centerHeight = Math.floor(height * 0.62);
  const center = await enhance(
    sharp(filePath).extract({ left: 0, top: centerTop, width, height: centerHeight }).resize(width * 2, centerHeight * 2)
  )
    .png()
    .toBuffer();
  variants.push(await writeVariant(center, `${stem}-center.png`));

  // Bottom summary strip — Profit / Gewinn / Kontostand lines
  const stripHeight = Math.floor(height * 0.22);
  const stripTop = Math.max(0, height - stripHeight - Math.floor(height * 0.08));
  const bottomStrip = await enhance(
    sharp(filePath)
      .extract({ left: 0, top: stripTop, width, height: Math.min(stripHeight, height - stripTop) })
      .resize(width * 2, stripHeight * 2)
  )
    .png()
    .toBuffer();
  variants.push(await writeVariant(bottomStrip, `${stem}-bottom.png`));

  // Right column — MT5 profit numbers sit on the right
  const colLeft = Math.floor(width * 0.45);
  const colWidth = width - colLeft;
  const rightCol = await enhance(
    sharp(filePath)
      .extract({ left: colLeft, top: centerTop, width: colWidth, height: centerHeight })
      .resize(colWidth * 2, centerHeight * 2)
  )
    .png()
    .toBuffer();
  variants.push(await writeVariant(rightCol, `${stem}-right.png`));

  return variants;
};

module.exports = { buildOcrVariants };
