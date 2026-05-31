const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const root = path.join(__dirname, "..", "..");
const dataDir = path.join(root, "data", "results-publisher");
const inboxDir = path.join(dataDir, "inbox");

const parseList = (value, fallback) => {
  const raw = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return raw.length ? raw : fallback;
};

const parseIntEnv = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const config = {
  root,
  dataDir,
  inboxDir,
  token: String(process.env.TELEGRAM_BOT_TOKEN || "").trim(),
  adminUserId: String(process.env.TELEGRAM_ADMIN_USER_ID || "").trim(),
  resultsChannelId: String(process.env.TELEGRAM_RESULTS_CHANNEL_ID || "").trim(),
  officialChannelId: String(process.env.TELEGRAM_OFFICIAL_CHANNEL_ID || "").trim(),
  siteUrl: String(process.env.APP_URL || "https://zonexbot.com").replace(/\/$/, ""),
  checkoutUrl: String(process.env.APP_URL || "https://zonexbot.com").replace(/\/$/, "") + "/checkout",
  ownerHandle: "@zonexowner",
  postsPerDay: parseIntEnv(process.env.RESULTS_POSTS_PER_DAY, 3),
  postHoursUtc: parseList(process.env.RESULTS_POST_HOURS_UTC, ["10", "15", "20"]).map(Number),
  ollamaUrl: String(process.env.OLLAMA_URL || "").trim(),
  ollamaVisionModel: String(process.env.OLLAMA_VISION_MODEL || "llava:13b").trim(),
  autoPostMinConfidence: Number(process.env.RESULTS_AUTO_CONFIDENCE || 0.75),
  autoPostEnabled: String(process.env.RESULTS_AUTO_POST || "false").toLowerCase() === "true",
  autoQueueEnabled: String(process.env.RESULTS_AUTO_QUEUE || "false").toLowerCase() === "true",
  queueMode: String(process.env.RESULTS_QUEUE_MODE || "both").toLowerCase() === "results" ? "results" : "both",
  pollIntervalMs: 1500,
  mediaGroupWaitMs: 4000,
};

module.exports = config;
