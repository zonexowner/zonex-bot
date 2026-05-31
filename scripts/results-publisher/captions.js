const config = require("./config");

const truncateAtWord = (text, max = 180) => {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max).trim()}…`;
};

const formatProfit = (profit, currency = "USD") => {
  if (profit == null) return null;
  const code = currency === "EUR" ? "EUR" : "USD";
  return `${profit >= 0 ? "+" : ""}${Number(profit).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${code}`;
};

/**
 * Fixed caption templates — edit here, no AI prompt needed.
 */
const buildCaptions = (extraction, ocrText = "", cleanQuoteFn) => {
  const profitLabel = formatProfit(extraction.profit_total, extraction.profit_currency);
  const quote = cleanQuoteFn(extraction.user_quote);
  const period = extraction.period_label || "Account history";

  if (extraction.reject_reason === "wrong_symbol") {
    const symList =
      (extraction.symbols || []).filter((s) => !/xauusd|gold/i.test(s)).join(", ") || "non-gold pairs";
    return {
      status: "skip",
      caption_results: "",
      caption_official: "",
      headline_profit: profitLabel,
      skip_reason: `Non-XAUUSD symbols detected: ${symList}`,
    };
  }

  // ── RESULTS (private) ──────────────────────────────────────────────
  const results = [
    "ZoneX Bot · Licensed member result",
    "",
    "Gold (XAUUSD) · MetaTrader 5",
    `${period} · Closed P/L: ${profitLabel || "see screenshot"}`,
  ];
  if (quote) {
    results.push("", "Client message:", `"${quote}"`);
  }
  results.push("", "Private operator channel.", "Not financial advice · past results vary.");

  // ── OFFICIAL (public) ──────────────────────────────────────────────
  const official = [
    "ZoneX Bot · XAUUSD · MT5",
    "",
    profitLabel ? `${period} · ${profitLabel} closed P/L` : "Verified operator screenshot.",
  ];
  if (quote) {
    official.push("", `Member: "${truncateAtWord(quote, 160)}"`);
  }
  official.push(
    "",
    "Results vary. Not financial advice.",
    config.checkoutUrl,
    config.ownerHandle
  );

  const status =
    extraction.profit_total == null || extraction.confidence < 0.65 || !extraction.is_xauusd_only
      ? "review"
      : "post";

  return {
    status,
    caption_results: results.join("\n"),
    caption_official: official.join("\n"),
    headline_profit: profitLabel,
    skip_reason: null,
  };
};

module.exports = { buildCaptions, formatProfit, truncateAtWord };
