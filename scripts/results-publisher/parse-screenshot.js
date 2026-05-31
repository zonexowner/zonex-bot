const GOLD_PATTERN = /xauusd\+?|xauusdm|gold\.?pro?|goldm/i;
const { cleanQuote, pickBestQuote } = require("./text-utils");
const NOISE_WORDS = new Set([
  "THE",
  "AND",
  "FOR",
  "SELL",
  "BUY",
  "PRO",
  "DAY",
  "WEEK",
  "MONTH",
  "HISTORY",
  "TRADE",
  "QUOTES",
  "CHART",
  "SETTINGS",
  "TELEGRAM",
  "MESSAGE",
  "PROFIT",
  "BALANCE",
  "CREDIT",
  "DEPOSIT",
  "WITHDRAWAL",
  "HISTORIE",
  "KONTOSTAND",
  "GEWINN",
  "EINZAHLUNG",
  "WOCHEN",
  "TAG",
  "MONAT",
]);

const parseMoney = (raw) => {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[\s,]/g, "").trim();
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

const findSymbols = (text) => {
  const found = new Set();
  const patterns = [
    /\b(XAUUSD\+?|XAUUSD(?:\.pro|m)?|GOLD(?:\.pro|m)?)\b/gi,
    /\b([A-Z]{3,6}\.pro)\b/gi,
    /\b(US30|US500|NAS100|DE40|UK100)\b/gi,
    /\b([A-Z]{6})\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      let symbol = match[1].toUpperCase();
      if (symbol.endsWith("+")) symbol = symbol.slice(0, -1);
      if (symbol === "KAUUSD") symbol = "XAUUSD";
      if (NOISE_WORDS.has(symbol)) continue;
      if (symbol.length < 3) continue;
      found.add(symbol);
    }
  }

  if (!found.size && /xauusd|kauusd/i.test(text)) {
    found.add("XAUUSD");
  }

  return [...found];
};

const isGoldSymbol = (symbol) => GOLD_PATTERN.test(symbol);

const extractProfit = (text) => {
  const lines = text.split(/\r?\n/);
  let profit = null;
  let balance = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const next = lines[i + 1]?.trim() || "";

    if (/^(profit|gewinn)$/i.test(line)) {
      profit = parseMoney(next) ?? parseMoney(line.match(/(-?\d[\d\s,]*\.?\d*)/)?.[1]);
    }
    if (/^(profit|gewinn)[:\s]/i.test(line)) {
      profit = parseMoney(line.replace(/^(profit|gewinn)[:\s]*/i, ""));
    }
    if (/^(balance|kontostand)$/i.test(line)) {
      balance = parseMoney(next);
    }
    if (/^(balance|kontostand)[:\s]/i.test(line)) {
      balance = parseMoney(line.replace(/^(balance|kontostand)[:\s]*/i, ""));
    }
  }

  const patterns = [
    /(?:profit|gewinn)[\s\S]{0,30}?(-?\d[\d\s,]*\.\d{2})/i,
    /(?:kontostand|balance)[\s\S]{0,30}?(-?\d[\d\s,]*\.\d{2})/i,
  ];
  for (const pattern of patterns) {
    if (profit != null) break;
    const match = text.match(pattern);
    if (match) profit = parseMoney(match[1]);
  }

  return { profit_total: profit, balance };
};

const extractPeriod = (text) => {
  if (/(history|historie)/i.test(text) && /(day|tag)/i.test(text)) {
    return { period: "day", period_label: "Day" };
  }
  if (/(week|woche)/i.test(text) && /(two weeks|2 weeks|last two)/i.test(text)) {
    return { period: "custom", period_label: "Last 2 weeks" };
  }
  if (/(week|woche)/i.test(text) && /(history|historie)/i.test(text)) {
    return { period: "week", period_label: "This week" };
  }
  if (/(month|monat)/i.test(text) && /(history|historie)/i.test(text)) {
    return { period: "month", period_label: "This month" };
  }
  return { period: "unknown", period_label: "Account history" };
};

const extractDate = (text) => {
  const dotted = text.match(/\b(20\d{2}\.\d{2}\.\d{2})\b/);
  if (dotted) return dotted[1].replace(/\./g, "-");
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso ? iso[1] : null;
};

const extractUserQuote = (text) => cleanQuote(pickBestQuote(text));

const scoreConfidence = ({ profit_total, symbols, ocrLength, hasGoldMention }) => {
  let score = 0.35;
  if (profit_total != null) score += 0.35;
  if (symbols.length || hasGoldMention) score += 0.15;
  if (ocrLength > 80) score += 0.1;
  if (ocrLength > 200) score += 0.05;
  return Math.min(0.95, Number(score.toFixed(2)));
};

const parseOcrText = (text) => {
  const ocrText = String(text || "");
  const symbols = findSymbols(ocrText);
  const { profit_total, balance } = extractProfit(ocrText);
  const { period, period_label } = extractPeriod(ocrText);
  const date_visible = extractDate(ocrText);
  const user_quote = extractUserQuote(ocrText);
  const hasGoldMention = /xauusd|kauusd|gold/i.test(ocrText);

  const goldSymbols = symbols.filter(isGoldSymbol);
  const otherSymbols = symbols.filter((s) => !isGoldSymbol(s));

  const is_xauusd_only =
    (symbols.length > 0 && goldSymbols.length > 0 && otherSymbols.length === 0) ||
    (hasGoldMention && otherSymbols.length === 0 && goldSymbols.length > 0);
  const is_likely_zonex =
    is_xauusd_only ||
    /zonex|zone x|gold bot|xauusd bot|ai bot/i.test(ocrText) ||
    (hasGoldMention && /bot/i.test(ocrText));

  let reject_reason = null;
  if (otherSymbols.length > 0) {
    reject_reason = "wrong_symbol";
  }

  const image_type = /history|historie|profit|gewinn|kontostand|deposit|einzahlung/i.test(ocrText)
    ? "mt5_history"
    : /telegram|message|chat|chemsi|robo/i.test(ocrText)
      ? "telegram_chat_only"
      : "unclear";

  const confidence = scoreConfidence({
    profit_total,
    symbols,
    ocrLength: ocrText.length,
    hasGoldMention,
  });

  return {
    image_type,
    period,
    period_label,
    symbols: symbols.length ? symbols : hasGoldMention ? ["XAUUSD"] : [],
    is_xauusd_only: is_xauusd_only || (hasGoldMention && otherSymbols.length === 0),
    is_likely_zonex,
    profit_total,
    profit_currency: "USD",
    balance,
    trade_count: null,
    winning_trades: null,
    losing_trades: null,
    date_visible,
    user_quote,
    confidence,
    reject_reason,
    notes: "Local OCR (free, no API)",
    ocr_preview: ocrText.slice(0, 400),
  };
};

module.exports = { parseOcrText };
