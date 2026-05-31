const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");

const queuePath = path.join(config.dataDir, "queue.json");

const ensureDataDir = () => {
  fs.mkdirSync(config.inboxDir, { recursive: true });
  if (!fs.existsSync(queuePath)) {
    fs.writeFileSync(queuePath, JSON.stringify({ items: [] }, null, 2));
  }
};

const loadQueue = () => {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(queuePath, "utf8"));
  } catch {
    return { items: [] };
  }
};

const saveQueue = (data) => {
  ensureDataDir();
  fs.writeFileSync(queuePath, JSON.stringify(data, null, 2));
};

const newId = () => crypto.randomBytes(4).toString("hex");

const startOfUtcDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const nextScheduledAt = () => {
  const data = loadQueue();
  const now = new Date();
  const hours = config.postHoursUtc.filter((h) => h >= 0 && h <= 23).sort((a, b) => a - b);
  const slots = hours.length ? hours : [10, 15, 20];

  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const dayStart = startOfUtcDay(now);
    dayStart.setUTCDate(dayStart.getUTCDate() + dayOffset);

    const scheduledOnDay = data.items.filter((item) => {
      if (!item.scheduledAt || item.status === "skipped") return false;
      return startOfUtcDay(new Date(item.scheduledAt)).getTime() === dayStart.getTime();
    });

    if (scheduledOnDay.length >= config.postsPerDay) continue;

    for (const hour of slots) {
      const slot = new Date(dayStart);
      slot.setUTCHours(hour, 0, 0, 0);
      if (slot <= now) continue;

      const slotTaken = scheduledOnDay.some(
        (item) => Math.abs(new Date(item.scheduledAt).getTime() - slot.getTime()) < 60000
      );
      if (slotTaken) continue;

      return slot.toISOString();
    }
  }

  const fallback = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  fallback.setUTCHours(slots[0], 0, 0, 0);
  return fallback.toISOString();
};

const createItem = (payload) => {
  const data = loadQueue();
  const item = {
    id: newId(),
    createdAt: new Date().toISOString(),
    scheduledAt: null,
    status: "draft",
    ...payload,
  };
  data.items.push(item);
  saveQueue(data);
  return item;
};

const getItem = (id) => loadQueue().items.find((item) => item.id === id) || null;

const updateItem = (id, patch) => {
  const data = loadQueue();
  const index = data.items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  data.items[index] = { ...data.items[index], ...patch };
  saveQueue(data);
  return data.items[index];
};

const dueItems = () => {
  const now = Date.now();
  return loadQueue().items.filter(
    (item) =>
      item.status === "scheduled" &&
      item.scheduledAt &&
      new Date(item.scheduledAt).getTime() <= now
  );
};

const queueStats = () => {
  const items = loadQueue().items;
  return {
    draft: items.filter((i) => i.status === "draft").length,
    scheduled: items.filter((i) => i.status === "scheduled").length,
    posted: items.filter((i) => i.status === "posted").length,
    skipped: items.filter((i) => i.status === "skipped").length,
  };
};

const getDraftItems = (batchId = null) =>
  loadQueue().items.filter((item) => {
    if (item.status !== "draft") return false;
    if (batchId) return item.batchId === batchId;
    return true;
  });

const setScheduledMode = (mode) => {
  const data = loadQueue();
  let count = 0;
  data.items.forEach((item) => {
    if (item.status !== "scheduled") return;
    item.scheduledMode = mode;
    count += 1;
  });
  saveQueue(data);
  return count;
};

module.exports = {
  ensureDataDir,
  loadQueue,
  getDraftItems,
  setScheduledMode,
  createItem,
  getItem,
  updateItem,
  dueItems,
  nextScheduledAt,
  queueStats,
  newId,
};
