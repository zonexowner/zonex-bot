const config = require("./config");

const apiBase = () => `https://api.telegram.org/bot${config.token}`;

const tg = async (method, body = {}) => {
  if (!config.token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing in .env");
  }
  const response = await fetch(`${apiBase()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
};

const isBenignTelegramError = (message) =>
  /message is not modified|message to edit not found/i.test(String(message || ""));

const safeTelegram = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    if (isBenignTelegramError(err.message)) return null;
    throw err;
  }
};

const tgForm = async (method, formData) => {
  if (!config.token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing in .env");
  }
  const response = await fetch(`${apiBase()}/${method}`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
};

const sendMessage = (chatId, text, extra = {}) =>
  tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });

const sendPhoto = (chatId, photo, caption, extra = {}) =>
  tg("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    ...extra,
  });

const sendPhotoFile = async (chatId, filePath, caption, extra = {}) => {
  const fs = require("fs");
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  if (extra.reply_markup) {
    form.append("reply_markup", JSON.stringify(extra.reply_markup));
  }
  form.append("photo", new Blob([fs.readFileSync(filePath)]), "screenshot.jpg");
  return tgForm("sendPhoto", form);
};

const answerCallback = (callbackQueryId, text) =>
  tg("answerCallbackQuery", { callback_query_id: callbackQueryId, text }).catch(() => {});

const editMessageReplyMarkup = (chatId, messageId, replyMarkup) =>
  tg("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup });

const editMessageCaption = (chatId, messageId, caption, extra = {}) =>
  tg("editMessageCaption", {
    chat_id: chatId,
    message_id: messageId,
    caption,
    parse_mode: "HTML",
    ...extra,
  });

const downloadFile = async (fileId, destPath) => {
  const fs = require("fs");
  const path = require("path");
  const file = await tg("getFile", { file_id: fileId });
  const filePath = file.file_path;
  const url = `https://api.telegram.org/file/bot${config.token}/${filePath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not download Telegram file");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
  return destPath;
};

const inlineKeyboard = (rows) => ({ inline_keyboard: rows });

const editMessageText = (chatId, messageId, text, extra = {}) =>
  tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...extra,
  });

module.exports = {
  tg,
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
};
