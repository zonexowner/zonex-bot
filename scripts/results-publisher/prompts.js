/**
 * Extraction spec + optional Ollama vision prompt (free, local).
 * Used by vision.js when OLLAMA_URL is set.
 */

const EXTRACTION_JSON_SCHEMA = `{
  "image_type": "mt5_history | mt5_trade_tab | telegram_chat_only | dashboard | unclear",
  "period_label": "Day | Week | 2 weeks | Month | session",
  "symbols": ["XAUUSD"],
  "is_xauusd_only": true,
  "profit_total": 1850.49,
  "profit_currency": "USD",
  "balance": null,
  "user_quote": "short chat quote if visible",
  "confidence": 0.85,
  "reject_reason": null
}`;

const OLLAMA_VISION_SYSTEM = `You extract trading result data from mobile screenshots for ZoneX Bot (XAUUSD-only MT5 EA).

Look for:
1. MT5 mobile History tab (English or German UI)
2. Embedded MT5 screenshot inside Telegram/iMessage chats
3. Summary rows at bottom: Profit/Gewinn, Balance/Kontostand, Credit/Kredit

Rules:
- profit_total = the summary Profit/Gewinn row total (NOT individual trade rows)
- German numbers may use spaces: "1 850.49" means 1850.49
- XAUUSD, XAUUSD+, GOLD = gold. GBPUSD, US30, NAS100 = NOT ZoneX (reject)
- is_xauusd_only = true ONLY if all visible closed trades are gold/XAUUSD
- user_quote = best client message about the bot (if Telegram chat visible)
- confidence 0.9+ if profit_total and XAUUSD both clear; 0.5-0.7 if partial; below 0.5 if guess
- reject_reason = "wrong_symbol" if no XAUUSD or mixed pairs dominate
- Never invent numbers. Use null if unreadable.

Return JSON only, no markdown:
${EXTRACTION_JSON_SCHEMA}`;

const OLLAMA_VISION_USER = "Extract structured result data from this screenshot for ZoneX operator reporting.";

module.exports = {
  EXTRACTION_JSON_SCHEMA,
  OLLAMA_VISION_SYSTEM,
  OLLAMA_VISION_USER,
};
