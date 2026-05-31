#!/usr/bin/env node
/**
 * Find Telegram channel IDs without forwarding messages.
 *
 * Setup:
 * 1. Add your bot as ADMIN on the private channel
 * 2. Post any message IN that channel (e.g. "test")
 * 3. Run: npm run channel-ids
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN in .env first");
  process.exit(1);
}

const main = async () => {
  const url = `https://api.telegram.org/bot${token}/getUpdates?limit=100`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) {
    console.error("Telegram error:", data.description);
    if (/another.*getUpdates|Conflict/i.test(data.description || "")) {
      console.error("\nStop npm run results-bot first, then run channel-ids again.\n");
    }
    process.exit(1);
  }

  const chats = new Map();
  const collect = (chat) => {
    if (!chat?.id) return;
    if (chat.type !== "channel" && chat.type !== "supergroup") return;
    const { id, title, username, type } = chat;
    chats.set(id, { id, title: title || username || "(no title)", username, type });
  };

  for (const update of data.result || []) {
    collect(update.channel_post?.chat);
    collect(update.edited_channel_post?.chat);
    collect(update.my_chat_member?.chat);
    collect(update.chat_member?.chat);
    if (update.message?.chat?.type === "channel") {
      collect(update.message.chat);
    }
  }

  if (!chats.size) {
    console.log("\nNo channel IDs in bot history yet.\n");
    console.log("Option A — post in channel:");
    console.log("  1. Bot must be ADMIN on Results (you did this ✓)");
    console.log("  2. Open ZoneX Bot Results → post: test");
    console.log("  3. Stop results-bot if running, then: npm run channel-ids\n");
    console.log("Option B — while bot is running:");
    console.log("  1. npm run results-bot");
    console.log("  2. Post test in Results channel");
    console.log("  3. Bot DMs you the channel ID automatically\n");
    console.log("Option C: paste t.me/+ invite link to @RawDataBot in private chat.\n");
    return;
  }

  console.log("\nChannel IDs found:\n");
  for (const chat of chats.values()) {
    const handle = chat.username ? `@${chat.username}` : "(private, no @username)";
    console.log(`  ${chat.title}`);
    console.log(`  ID: ${chat.id}`);
    console.log(`  ${handle}`);
    console.log("");
  }
  console.log("Copy into .env:");
  console.log("  TELEGRAM_RESULTS_CHANNEL_ID=-100...");
  console.log("  TELEGRAM_OFFICIAL_CHANNEL_ID=-100...\n");
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
