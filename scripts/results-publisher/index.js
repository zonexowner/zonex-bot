const path = require("path");
const config = require("./config");
const { analyzeImage } = require("./vision");
const {
  createItem,
  getItem,
  updateItem,
  dueItems,
  nextScheduledAt,
  queueStats,
  loadQueue,
  getDraftItems,
  setScheduledMode,
  ensureDataDir,
  newId,
} = require("./store");
const {
  sendMessage,
  sendPhoto,
  sendPhotoFile,
  answerCallback,
  editMessageReplyMarkup,
  editMessageCaption,
  editMessageText,
  downloadFile,
  inlineKeyboard,
  safeTelegram,
  tg,
} = require("./telegram");

ensureDataDir();

const pendingGroups = new Map();
const batchQueue = [];
let batchRunning = false;
let offset = 0;

const isAdmin = (userId) => String(userId) === config.adminUserId;

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const validateConfig = () => {
  const missing = [];
  if (!config.token) missing.push("TELEGRAM_BOT_TOKEN");
  if (!config.adminUserId) missing.push("TELEGRAM_ADMIN_USER_ID");
  if (missing.length) {
    console.error("\nMissing required .env values:");
    missing.forEach((key) => console.error(`  - ${key}`));
    process.exit(1);
  }
  if (!config.resultsChannelId || !config.officialChannelId) {
    console.warn("\nDiscovery mode — channel IDs not set yet.");
    console.warn("Post test in each channel; bot will DM you the IDs to paste in .env\n");
  }
};

const previewText = (item) => {
  const { extraction, captions } = item;
  return [
    `<b>ZoneX · ${item.id}</b>`,
    `Profit: ${escapeHtml(captions.headline_profit || "unknown")}`,
    `Symbols: ${escapeHtml((extraction.symbols || []).join(", ") || "unknown")}`,
    `XAUUSD: ${extraction.is_xauusd_only ? "yes" : "no"} · conf ${Number(extraction.confidence || 0).toFixed(2)}`,
    extraction.user_quote ? `"${escapeHtml(extraction.user_quote.slice(0, 80))}"` : "",
    captions.skip_reason ? `Note: ${escapeHtml(captions.skip_reason)}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 400);
};

const actionKeyboard = (itemId) =>
  inlineKeyboard([
    [
      { text: "Post both", callback_data: `pb:${itemId}` },
      { text: "Results only", callback_data: `pr:${itemId}` },
    ],
    [
      { text: "Queue for schedule", callback_data: `pq:${itemId}` },
      { text: "Skip", callback_data: `ps:${itemId}` },
    ],
  ]);

const batchKeyboard = (batchId) =>
  inlineKeyboard([
    [
      { text: "Queue all · both channels", callback_data: `qab:${batchId}` },
      { text: "Queue all · Results only", callback_data: `qar:${batchId}` },
    ],
    [{ text: "Skip all", callback_data: `qas:${batchId}` }],
  ]);

const queueDraftItems = (itemIds, mode) => {
  const lines = [];
  for (const id of itemIds) {
    const item = getItem(id);
    if (!item || item.status !== "draft") continue;
    const slot = nextScheduledAt();
    updateItem(id, {
      status: "scheduled",
      scheduledAt: slot,
      scheduledMode: mode,
    });
    lines.push(`${id} → ${slot}`);
  }
  return lines;
};

const processPhoto = async (message, options = {}) => {
  const { batchMode = false, batchId = null } = options;
  const userId = message.from?.id;
  if (!isAdmin(userId)) {
    await sendMessage(message.chat.id, "This bot is private. Only the ZoneX admin can upload screenshots.");
    return null;
  }

  const photos = message.photo || [];
  if (!photos.length) return null;
  const best = photos[photos.length - 1];
  const fileName = `${Date.now()}-${newId()}.jpg`;
  const filePath = path.join(config.inboxDir, fileName);

  if (!batchMode) {
    await sendMessage(message.chat.id, "Reading screenshot (local OCR, free)…");
  }

  await downloadFile(best.file_id, filePath);

  const { extraction, captions } = await analyzeImage(filePath, message.caption || null, {
    fast: batchMode,
  });
  const item = createItem({
    filePath,
    fileId: best.file_id,
    extraction,
    captions,
    previewChatId: message.chat.id,
    batchId,
  });

  if (config.autoQueueEnabled && captions.status !== "skip") {
    scheduleItem(item.id);
    if (!batchMode) {
      await sendMessage(
        message.chat.id,
        `Auto-queued <b>${item.id}</b>\nProfit: ${escapeHtml(captions.headline_profit || "n/a")}\nUse /queue to see schedule.`
      );
    }
    return item.id;
  }

  const canAuto =
    config.autoPostEnabled &&
    captions.status === "post" &&
    extraction.is_xauusd_only &&
    Number(extraction.confidence || 0) >= config.autoPostMinConfidence;

  if (canAuto) {
    await publishItem(item.id, "both");
    if (!batchMode) {
      await sendMessage(
        message.chat.id,
        `Auto-posted <b>${item.id}</b> to Results + Official.\nProfit: ${escapeHtml(captions.headline_profit || "n/a")}`
      );
    }
    return item.id;
  }

  if (batchMode) {
    return item.id;
  }

  const keyboard = actionKeyboard(item.id);
  await sendPhotoFile(message.chat.id, filePath, previewText(item));
  await sendMessage(
    message.chat.id,
    `<b>Status:</b> ${escapeHtml(captions.status)}\n\n<b>Results</b>\n${escapeHtml(captions.caption_results || "—")}\n\n<b>Official</b>\n${escapeHtml(captions.caption_official || "—")}\n\nChoose action:`,
    { reply_markup: keyboard }
  );
  return item.id;
};

const publishItem = async (itemId, mode) => {
  const item = getItem(itemId);
  if (!item) throw new Error("Item not found");
  if (item.status === "posted") {
    throw new Error("Already posted. Send a new screenshot to publish again.");
  }

  const { captions, filePath } = item;

  if (mode === "both" || mode === "results") {
    if (!config.resultsChannelId) {
      throw new Error("TELEGRAM_RESULTS_CHANNEL_ID missing");
    }
    await sendPhotoFile(config.resultsChannelId, filePath, captions.caption_results);
  }
  if (mode === "both" || mode === "official") {
    if (!config.officialChannelId) {
      throw new Error("TELEGRAM_OFFICIAL_CHANNEL_ID missing");
    }
    await sendPhotoFile(config.officialChannelId, filePath, captions.caption_official);
  }

  return updateItem(itemId, {
    status: "posted",
    postedAt: new Date().toISOString(),
    postedMode: mode,
  });
};

const markActionDone = async (query, item, label) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const body = `${previewText(item)}\n\n<b>${label}</b>`;
  const emptyKeyboard = { inline_keyboard: [] };

  if (query.message.photo) {
    await safeTelegram(() =>
      editMessageCaption(chatId, messageId, body, { reply_markup: emptyKeyboard })
    );
    return;
  }

  await safeTelegram(() =>
    editMessageText(chatId, messageId, body, { reply_markup: emptyKeyboard })
  );
};

const scheduleItem = (itemId, mode = config.queueMode) => {
  const slot = nextScheduledAt();
  return updateItem(itemId, {
    status: "scheduled",
    scheduledAt: slot,
    scheduledMode: mode,
  });
};

const handleCallback = async (query) => {
  const userId = query.from?.id;
  if (!isAdmin(userId)) {
    await answerCallback(query.id, "Not authorized");
    return;
  }

  const data = String(query.data || "");
  const [action, refId] = data.split(":");

  try {
    if (action === "qab" || action === "qar" || action === "qas") {
      const mode = action === "qar" ? "results" : action === "qas" ? "skip" : "both";
      const drafts = getDraftItems(refId);
      if (!drafts.length) {
        await answerCallback(query.id, "Nothing to queue");
        return;
      }
      if (mode === "skip") {
        drafts.forEach((d) => updateItem(d.id, { status: "skipped" }));
        await answerCallback(query.id, "Skipped all");
        await editMessageText(
          query.message.chat.id,
          query.message.message_id,
          `${query.message.text}\n\n<b>Skipped all ${drafts.length} items.</b>`,
          { reply_markup: { inline_keyboard: [] } }
        );
        return;
      }
      const lines = queueDraftItems(
        drafts.map((d) => d.id),
        mode
      );
      await answerCallback(query.id, `Queued ${lines.length}`);
      await editMessageText(
        query.message.chat.id,
        query.message.message_id,
        `${query.message.text}\n\n<b>Queued ${lines.length} posts</b> (${mode}).\nFirst slot: ${escapeHtml(lines[0]?.split(" → ")[1] || "see /queue")}`,
        { reply_markup: { inline_keyboard: [] } }
      );
      return;
    }

    const item = getItem(refId);
    if (!item) {
      await answerCallback(query.id, "Expired");
      return;
    }

    if (action === "pb") {
      await publishItem(refId, "both");
      await answerCallback(query.id, "Posted to Results + Official");
      await markActionDone(query, item, "Posted to Results + Official");
    } else if (action === "pr") {
      await publishItem(refId, "results");
      await answerCallback(query.id, "Posted to Results only");
      await markActionDone(query, item, "Posted to Results only");
    } else if (action === "pq") {
      const scheduled = scheduleItem(refId);
      await answerCallback(query.id, "Queued");
      const body = `${previewText(item)}\n\n<b>Scheduled:</b> ${escapeHtml(scheduled.scheduledAt)}`;
      await safeTelegram(() =>
        editMessageText(query.message.chat.id, query.message.message_id, body, {
          reply_markup: { inline_keyboard: [] },
        })
      );
    } else if (action === "ps") {
      updateItem(refId, { status: "skipped" });
      await answerCallback(query.id, "Skipped");
      await markActionDone(query, item, "Skipped");
    }
  } catch (err) {
    await answerCallback(query.id, "Failed");
    await sendMessage(query.message.chat.id, `Error: ${escapeHtml(err.message)}`);
  }
};

const handleCommand = async (message) => {
  const text = String(message.text || "").trim();
  const chatId = message.chat.id;
  if (!isAdmin(message.from?.id)) {
    await sendMessage(chatId, "Private bot. Admin only.");
    return;
  }

  if (text === "/start" || text === "/help") {
    await sendMessage(
      chatId,
      `<b>ZoneX Results Publisher</b>\n\n<b>1 image:</b> send → tap Post or Queue.\n\n<b>10 images:</b> send as one album → tap <b>Queue all</b>.\n\nSchedule: ${config.postsPerDay}/day at UTC ${config.postHoursUtc.join(", ")}.\n\n/queue · /queueall · /status · /postnow\n\nTip: set RESULTS_AUTO_QUEUE=true in .env to auto-schedule every upload.`
    );
    return;
  }

  if (text === "/status") {
    const stats = queueStats();
    await sendMessage(
      chatId,
      `<b>Queue</b>\ndraft: ${stats.draft}\nscheduled: ${stats.scheduled}\nposted: ${stats.posted}\nskipped: ${stats.skipped}`
    );
    return;
  }

  if (text === "/queue") {
    const items = loadQueue().items.filter((i) => i.status === "scheduled").slice(0, 10);
    if (!items.length) {
      await sendMessage(chatId, "No scheduled posts.");
      return;
    }
    const lines = items.map(
      (i) => `${i.id} · ${i.scheduledAt} · ${i.scheduledMode || "both"} · ${i.captions?.headline_profit || "?"}`
    );
    await sendMessage(chatId, `<b>Scheduled</b>\n${escapeHtml(lines.join("\n"))}`);
    return;
  }

  if (text === "/queueall") {
    const drafts = getDraftItems();
    if (!drafts.length) {
      await sendMessage(chatId, "No draft items. Send images first.");
      return;
    }
    const lines = queueDraftItems(
      drafts.map((d) => d.id),
      "both"
    );
    await sendMessage(chatId, `<b>Queued ${lines.length} posts</b> to Results + Official.\n\nUse /queue to see times.`);
    return;
  }

  if (text.startsWith("/queueall ")) {
    const mode = text.includes("results") ? "results" : "both";
    const drafts = getDraftItems();
    const lines = queueDraftItems(
      drafts.map((d) => d.id),
      mode
    );
    await sendMessage(chatId, `<b>Queued ${lines.length} posts</b> (${mode}).\n\nUse /queue to see times.`);
    return;
  }

  if (text === "/resultsonly") {
    const count = setScheduledMode("results");
    await sendMessage(
      chatId,
      count
        ? `<b>Updated ${count} scheduled posts</b> → Results channel only.\n\nOfficial channel will not receive these.`
        : "No scheduled posts to update."
    );
    return;
  }

  if (text === "/postnow") {
    const due = dueItems();
    if (!due.length) {
      await sendMessage(chatId, "Nothing due right now.");
      return;
    }
    for (const item of due) {
      await publishItem(item.id, item.scheduledMode || "both");
    }
    await sendMessage(chatId, `Published ${due.length} queued post(s).`);
  }
};

const runMediaGroupBatch = async (batch) => {
  if (!batch.length) return;

  const chatId = batch[0].chat.id;
  const batchId = newId();
  const total = batch.length;
  const progressMsg = await sendMessage(
    chatId,
    `Processing <b>${total}</b> screenshots…\n\n0/${total} done · OCR may take a few minutes on VPS`
  );

  const updateProgress = async (done, label = "") => {
    const text = [
      `Processing <b>${total}</b> screenshots…`,
      "",
      `<b>${done}/${total}</b> done${label ? ` · ${escapeHtml(label)}` : ""}`,
      done < total ? "Please wait — do not resend the album." : "",
    ]
      .filter(Boolean)
      .join("\n");
    await safeTelegram(() =>
      editMessageText(chatId, progressMsg.message_id, text)
    );
  };

  const itemIds = [];
  let ready = 0;
  let skip = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i += 1) {
    const message = batch[i];
    try {
      console.log(`Batch ${batchId}: image ${i + 1}/${total}`);
      const id = await processPhoto(message, { batchMode: true, batchId });
      if (!id) continue;
      itemIds.push(id);
      const item = getItem(id);
      if (item?.captions?.status === "skip") skip += 1;
      else ready += 1;
      await updateProgress(i + 1, item?.captions?.headline_profit || "ok");
    } catch (err) {
      failed += 1;
      console.error(`Batch ${batchId} image ${i + 1} failed:`, err.message);
      await updateProgress(i + 1, `error on ${i + 1}`);
    }
  }

  const summaryLines = [
    `<b>Batch ready · ${total} images</b>`,
    `Ready: ${ready} · Skip: ${skip}${failed ? ` · Failed: ${failed}` : ""}`,
    `Schedule: ${config.postsPerDay}/day at UTC ${config.postHoursUtc.join(", ")}`,
  ];

  const drafts = getDraftItems(batchId);
  const scheduledCount = itemIds.filter((id) => getItem(id)?.status === "scheduled").length;

  let replyMarkup = null;
  if (drafts.length > 1) {
    summaryLines.push("", `Tap <b>Queue all</b> to schedule ${drafts.length} remaining posts.`);
    replyMarkup = batchKeyboard(batchId);
  } else if (drafts.length === 1) {
    summaryLines.push("", "Review the preview below.");
  } else if (scheduledCount > 0 && config.autoQueueEnabled) {
    summaryLines.push(
      "",
      `Already auto-queued <b>${scheduledCount}</b> posts (${config.queueMode}).`,
      config.queueMode === "both"
        ? "Send <b>/resultsonly</b> to switch them to Results channel only."
        : "Send <b>/queue</b> to see times."
    );
  } else if (!itemIds.length) {
    summaryLines.push("", "No usable images — check VPS logs or resend with clearer MT5 screenshots.");
  }

  const summary = summaryLines.join("\n");

  if (itemIds.length > 1 && replyMarkup) {
    await safeTelegram(() =>
      editMessageText(chatId, progressMsg.message_id, summary, {
        reply_markup: replyMarkup,
      })
    );
  } else if (drafts.length === 1) {
    const item = getItem(itemIds[0]);
    const keyboard = actionKeyboard(itemIds[0]);
    await sendPhotoFile(chatId, item.filePath, previewText(item));
    await safeTelegram(() =>
      editMessageText(chatId, progressMsg.message_id, summary, { reply_markup: keyboard })
    );
  } else {
    await safeTelegram(() => editMessageText(chatId, progressMsg.message_id, summary));
  }
};

const drainBatchQueue = async () => {
  if (batchRunning) return;
  batchRunning = true;
  try {
    while (batchQueue.length) {
      const batch = batchQueue.shift();
      await runMediaGroupBatch(batch);
    }
  } finally {
    batchRunning = false;
  }
};

const enqueueMediaGroup = async (groupId) => {
  const batch = pendingGroups.get(groupId) || [];
  pendingGroups.delete(groupId);
  if (!batch.length) return;

  if (batchRunning || batchQueue.length) {
    const chatId = batch[0].chat.id;
    const position = batchQueue.length + (batchRunning ? 1 : 0);
    await sendMessage(
      chatId,
      `Batch queued · ${batch.length} images · position ${position + 1}.\n\nPlease wait — do not resend.`
    );
  }

  batchQueue.push(batch);
  await drainBatchQueue();
};

const handleChannelPost = async (post) => {
  const chat = post?.chat;
  if (!chat || chat.type !== "channel") return;

  const title = escapeHtml(chat.title || "Channel");
  const id = chat.id;
  const lines = [
    `<b>Channel detected</b>`,
    `${title}`,
    `ID: <code>${id}</code>`,
    "",
    "Add to .env:",
    chat.title?.toLowerCase().includes("result")
      ? `TELEGRAM_RESULTS_CHANNEL_ID=${id}`
      : `TELEGRAM_OFFICIAL_CHANNEL_ID=${id}`,
  ];

  console.log(`Channel post: ${chat.title} (${id})`);

  if (config.adminUserId) {
    await sendMessage(config.adminUserId, lines.join("\n"));
  }
};

const handleMyChatMember = async (update) => {
  const chat = update.chat;
  if (!chat || chat.type !== "channel") return;

  const title = escapeHtml(chat.title || "Channel");
  const id = chat.id;
  const status = update.new_chat_member?.status;

  if (!["administrator", "member"].includes(status)) return;

  console.log(`Bot added to channel: ${chat.title} (${id})`);

  if (config.adminUserId) {
    await sendMessage(
      config.adminUserId,
      [
        `<b>Bot joined channel</b>`,
        `${title}`,
        `ID: <code>${id}</code>`,
        "",
        chat.title?.toLowerCase().includes("result")
          ? `TELEGRAM_RESULTS_CHANNEL_ID=${id}`
          : `TELEGRAM_OFFICIAL_CHANNEL_ID=${id}`,
      ].join("\n")
    );
  }
};

const handleUpdate = async (update) => {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  if (update.channel_post) {
    await handleChannelPost(update.channel_post);
    return;
  }

  if (update.my_chat_member) {
    await handleMyChatMember(update.my_chat_member);
    return;
  }

  const message = update.message;
  if (!message) return;

  if (message.text?.startsWith("/")) {
    await handleCommand(message);
    return;
  }

  if (message.photo?.length) {
    const groupId = message.media_group_id;
    if (!groupId) {
      await processPhoto(message);
      return;
    }
    const batch = pendingGroups.get(groupId) || [];
    batch.push(message);
    pendingGroups.set(groupId, batch);
    if (batch._timer) clearTimeout(batch._timer);
    batch._timer = setTimeout(() => {
      enqueueMediaGroup(groupId).catch(async (err) => {
        console.error("Batch flush failed:", err.message);
        const chatId = batch[0]?.chat?.id;
        if (chatId) {
          await sendMessage(chatId, `Batch failed: ${escapeHtml(err.message)}`).catch(() => {});
        }
      });
    }, config.mediaGroupWaitMs);
  }
};

const runScheduler = async () => {
  const due = dueItems();
  for (const item of due) {
    try {
      await publishItem(item.id, item.scheduledMode || "both");
      if (item.previewChatId) {
        await sendMessage(
          item.previewChatId,
          `Scheduled post <b>${item.id}</b> published.\nProfit: ${escapeHtml(item.captions?.headline_profit || "n/a")}`
        );
      }
    } catch (err) {
      console.error("Scheduler publish failed:", item.id, err.message);
    }
  }
};

const poll = async () => {
  while (true) {
    try {
      const updates = await tg("getUpdates", {
        offset,
        timeout: 30,
        allowed_updates: ["message", "callback_query", "channel_post", "my_chat_member"],
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (err) {
      console.error("Poll error:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
};

validateConfig();
console.log("ZoneX Results Publisher running…");
console.log(`Admin user: ${config.adminUserId}`);
console.log(`Results channel: ${config.resultsChannelId || "(not set — discovery mode)"}`);
console.log(`Official channel: ${config.officialChannelId || "(not set — discovery mode)"}`);
console.log(`Posts/day: ${config.postsPerDay} at UTC hours ${config.postHoursUtc.join(", ")}`);
console.log("Vision: local Tesseract OCR (no paid API)");

const start = async () => {
  await tg("deleteWebhook", { drop_pending_updates: false });
  setInterval(runScheduler, 60 * 1000);
  await poll();
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
