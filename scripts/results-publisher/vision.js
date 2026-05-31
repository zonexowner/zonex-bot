const fs = require("fs");
const config = require("./config");
const { ocrMultiPass } = require("./ocr");
const { parseOcrText } = require("./parse-screenshot");
const { cleanQuote, inferPeriodLabel, pickBestQuote } = require("./text-utils");
const { buildCaptions } = require("./captions");
const { OLLAMA_VISION_SYSTEM, OLLAMA_VISION_USER } = require("./prompts");

const parseJson = (text) => {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw);
};

const imageToBase64 = (filePath) => fs.readFileSync(filePath).toString("base64");

const ollamaExtract = async (filePath) => {
  if (!config.ollamaUrl) return null;
  const model = config.ollamaVisionModel;
  const url = `${config.ollamaUrl.replace(/\/$/, "")}/api/chat`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: OLLAMA_VISION_SYSTEM },
        {
          role: "user",
          content: OLLAMA_VISION_USER,
          images: [imageToBase64(filePath)],
        },
      ],
    }),
  });
  if (!response.ok) {
    console.warn("Ollama vision failed:", await response.text());
    return null;
  }
  const data = await response.json();
  const content = data.message?.content;
  if (!content) return null;
  const parsed = parseJson(content);
  return {
    ...parsed,
    symbols: parsed.symbols || [],
    notes: `Ollama ${model}`,
  };
};

const pickBestExtraction = (candidates) => {
  return candidates.sort((a, b) => {
    const score = (x) =>
      (x.profit_total != null ? 3 : 0) +
      (x.is_xauusd_only ? 2 : 0) +
      Number(x.confidence || 0) +
      (x.symbols?.length ? 0.5 : 0);
    return score(b) - score(a);
  })[0];
};

const analyzeImage = async (filePath, telegramCaption = null, options = {}) => {
  const ocrText = await ocrMultiPass(filePath, { fast: options.fast });
  const ocrExtraction = parseOcrText(ocrText);

  let extraction = ocrExtraction;
  if (config.ollamaUrl) {
    try {
      const llmExtraction = await ollamaExtract(filePath);
      if (llmExtraction) {
        extraction = pickBestExtraction([llmExtraction, ocrExtraction]);
      }
    } catch (err) {
      console.warn("Ollama skipped:", err.message);
    }
  }

  const captionQuote = cleanQuote(telegramCaption);
  if (captionQuote) {
    extraction.user_quote = captionQuote;
  } else if (extraction.user_quote) {
    const cleaned = cleanQuote(extraction.user_quote);
    if (cleaned) {
      extraction.user_quote = cleaned;
    } else {
      const extended = pickBestQuote(ocrText);
      extraction.user_quote = extended || null;
    }
  }

  extraction.period_label =
    inferPeriodLabel(ocrText, extraction.user_quote) || extraction.period_label || "Account history";

  const captions = buildCaptions(extraction, ocrText, cleanQuote);
  return { extraction, captions, ocrText };
};

module.exports = { analyzeImage };
