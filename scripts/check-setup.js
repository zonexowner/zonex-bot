#!/usr/bin/env node
/**
 * Validates Path A production config (.env) and pings each service.
 * Usage: npm run setup:check
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..");
const EX5_PATH = path.join(ROOT, "secure_assets", "ZoneX_XAUUSD.ex5");

const required = [
  { key: "SUPABASE_URL", hint: "Supabase → Project Settings → API → Project URL" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", hint: "Supabase → API → service_role (secret, not anon)" },
  { key: "APP_URL", hint: "Public https URL, e.g. https://zonex.yourdomain.com" },
  { key: "RELAY_MODE", hint: "Must be: supabase" },
  { key: "RESEND_API_KEY", hint: "Resend → API Keys → Create" },
  { key: "RESEND_FROM_EMAIL", hint: "Verified sender, e.g. ZoneX <hello@yourdomain.com>" },
  { key: "COINBASE_API_KEY", hint: "Coinbase Commerce → Settings → API keys" },
  { key: "CRYPTO_WEBHOOK_SECRET", hint: "Coinbase Commerce → Settings → Webhook shared secret" },
];

const recommended = [
  { key: "TELEGRAM_BOT_TOKEN", hint: "Optional alerts via @BotFather" },
  { key: "TELEGRAM_CHAT_ID", hint: "Your chat id for payment notifications" },
  { key: "ADMIN_USERNAME", hint: "Admin panel login username" },
  { key: "ADMIN_PASSWORD", hint: "Admin panel login password" },
  { key: "PARTNER_REGISTRATION_URL", hint: "Vigco affiliate link" },
];

const placeholder = (value) => {
  const v = String(value || "").trim();
  if (!v) return true;
  return /YOUR_|yourdomain|example|changeme|xxx/i.test(v);
};

const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);
const fail = (msg) => console.log(`  ✗ ${msg}`);

async function main() {
  console.log("\nZoneX Path A setup check\n");

  if (!fs.existsSync(path.join(ROOT, ".env"))) {
    fail("No .env file. Copy .env.example → .env and fill in values.");
    console.log("  cp .env.example .env\n");
    process.exit(1);
  }

  let blockers = 0;

  console.log("1) Environment variables\n");
  for (const { key, hint } of required) {
    const val = process.env[key];
    if (!val || placeholder(val)) {
      fail(`${key} missing or still placeholder`);
      console.log(`     → ${hint}`);
      blockers += 1;
    } else {
      ok(`${key}`);
    }
  }

  if (process.env.RELAY_MODE !== "supabase") {
    fail(`RELAY_MODE is "${process.env.RELAY_MODE || ""}" — set to supabase for Path A`);
    blockers += 1;
  }

  console.log("\n2) Recommended\n");
  for (const { key, hint } of recommended) {
    const val = process.env[key];
    if (!val || placeholder(val)) warn(`${key} not set — ${hint}`);
    else ok(key);
  }

  console.log("\n3) EA binary (download after payment)\n");
  if (fs.existsSync(EX5_PATH)) ok("secure_assets/ZoneX_XAUUSD.ex5 found");
  else {
    warn("secure_assets/ZoneX_XAUUSD.ex5 missing — compile MQ5 and place file before go-live");
  }

  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  console.log("\n4) Coinbase Commerce webhook (paste in dashboard)\n");
  if (appUrl && !placeholder(appUrl)) {
    console.log(`  ${appUrl}/api/webhooks/crypto-billing`);
    console.log("  Enable event: charge:confirmed");
  } else {
    warn("Set APP_URL first to print webhook URL");
  }

  console.log("\n5) Live service checks\n");

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && !placeholder(process.env.SUPABASE_URL)) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: licErr } = await supabase.from("licenses").select("id").limit(1);
      const { error: leadErr } = await supabase.from("terminal_leads").select("id").limit(1);
      const { error: webhookErr } = await supabase.from("processed_webhook_events").select("id").limit(1);
      const { error: tokenColErr } = await supabase
        .from("terminal_leads")
        .select("activation_token")
        .limit(1);
      if (licErr?.message?.includes("does not exist") || leadErr?.message?.includes("does not exist")) {
        fail("Supabase tables missing — run supabase/setup.sql in SQL Editor");
        blockers += 1;
      } else if (webhookErr?.message?.includes("does not exist")) {
        fail("processed_webhook_events missing — run supabase/migration-002-critical-fixes.sql");
        blockers += 1;
      } else if (tokenColErr?.message?.includes("activation_token")) {
        fail("terminal_leads.activation_token missing — run supabase/migration-002-critical-fixes.sql");
        blockers += 1;
      } else if (licErr || leadErr || webhookErr || tokenColErr) {
        fail(`Supabase: ${(licErr || leadErr || webhookErr || tokenColErr).message}`);
        blockers += 1;
      } else {
        const { error: rpcErr } = await supabase.rpc("fulfill_payment", {
          p_event_id: "__setup_check_probe__",
          p_email: "__setup_check__@invalid.local",
          p_mt5: "00000",
          p_token: "0000000000000000",
          p_tx_hash: "SETUP_PROBE",
        });
        if (rpcErr?.message?.includes("Could not find the function")) {
          fail("fulfill_payment RPC missing — run supabase/migration-004-rpc-fulfillment.sql");
          blockers += 1;
        } else if (rpcErr?.message?.includes("Fulfillment rejected")) {
          ok("Supabase connected · licenses + terminal_leads + webhook dedupe + fulfill_payment RPC OK");
        } else if (rpcErr) {
          fail(`Supabase fulfill_payment RPC: ${rpcErr.message}`);
          blockers += 1;
        } else {
          ok("Supabase connected · licenses + terminal_leads + webhook dedupe + fulfill_payment RPC OK");
        }
      }
    } catch (e) {
      fail(`Supabase: ${e.message}`);
      blockers += 1;
    }
  }

  if (process.env.COINBASE_API_KEY && !placeholder(process.env.COINBASE_API_KEY)) {
    try {
      const res = await fetch("https://api.commerce.coinbase.com/charges", {
        method: "GET",
        headers: {
          "X-CC-Api-Key": process.env.COINBASE_API_KEY,
          "X-CC-Version": "2018-03-22",
        },
      });
      if (res.status === 401) {
        fail("Coinbase API key rejected (401)");
        blockers += 1;
      } else ok(`Coinbase Commerce API reachable (HTTP ${res.status})`);
    } catch (e) {
      fail(`Coinbase: ${e.message}`);
      blockers += 1;
    }
  }

  if (process.env.RESEND_API_KEY && !placeholder(process.env.RESEND_API_KEY)) {
    ok("Resend API key present (send test from dashboard after domain verify)");
  }

  console.log("\n6) Local dev note\n");
  console.log("  Coinbase webhooks need a public HTTPS URL.");
  console.log("  For local testing use ngrok: ngrok http 3001");
  console.log("  Then set APP_URL to the ngrok https URL and update Coinbase webhook.\n");

  if (blockers > 0) {
    console.log(`Setup incomplete — ${blockers} blocker(s). Fix .env and re-run: npm run setup:check\n`);
    process.exit(1);
  }

  console.log("All Path A blockers cleared. Start server: PORT=3001 npm run dev\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
