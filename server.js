const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Resend } = require("resend");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabase = Boolean(supabaseUrl && supabaseServiceRoleKey);
const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const walletByCurrency = {
  BTC: process.env.PAYMENT_WALLET_BTC || "bc1qexamplezonexterminaladdress9v7hp8s0a",
  ETH: process.env.PAYMENT_WALLET_ETH || "0x2B59A14f7A0a7e3f8B2b99585A89e5766D8fE17C",
  USDT_TRC20: process.env.PAYMENT_WALLET_USDT_TRC20 || "TXz8A6fQkK9W5h3P2Nq4YvZt7uLm2aS9Fd",
  USDT_ERC20: process.env.PAYMENT_WALLET_USDT_ERC20 || "0xA92c7DE5b8f810C4E4Aa335f10306B2a6d96aB11",
};

const networkByCurrency = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  USDT_TRC20: "TRC20",
  USDT_ERC20: "ERC20",
};

const amountOffset = () => Number((Math.floor(Math.random() * 90) + 1) / 100);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const PARTNER_REGISTRATION_URL =
  process.env.PARTNER_REGISTRATION_URL || "https://vigco.co/la-com-inv/ChYAH0aZ";
const PARTNER_BROKER_ID = process.env.PARTNER_BROKER_ID || "VIGCO";
const SITE_URL = String(process.env.APP_URL || "https://zonexbot.com").replace(/\/$/, "");
const TELEGRAM_OFFICIAL_URL = process.env.TELEGRAM_OFFICIAL_URL || "https://t.me/ZoneXBotOfficial";
const TELEGRAM_RESULTS_URL = process.env.TELEGRAM_RESULTS_URL || "";
const TELEGRAM_OWNER_URL = process.env.TELEGRAM_OWNER_URL || "https://t.me/zonexowner";

const buildActivationToken = (mt5Account, txHash) =>
  crypto
    .createHash("sha256")
    .update(`${mt5Account}-${txHash}`)
    .digest("hex")
    .substring(0, 16)
    .toUpperCase();

const partnerTxHash = (mt5Account) => `PARTNER_VIGCO_${mt5Account}`;
const relayMode = String(process.env.RELAY_MODE || "telegram").toLowerCase();
const webhookSecret = String(process.env.CRYPTO_WEBHOOK_SECRET || "");
const coinbaseApiKey = String(process.env.COINBASE_API_KEY || "").trim();
const nowPaymentsApiKey = String(process.env.NOWPAYMENTS_API_KEY || "").trim();
const nowPaymentsIpnSecret = String(process.env.NOWPAYMENTS_IPN_SECRET || "").trim();
const nowPaymentsSandbox = String(process.env.NOWPAYMENTS_SANDBOX || "").toLowerCase() === "true";
const nowPaymentsApiBase = nowPaymentsSandbox
  ? "https://api-sandbox.nowpayments.io/v1"
  : "https://api.nowpayments.io/v1";
const paymentProviderSetting = String(process.env.PAYMENT_PROVIDER || "").trim().toLowerCase();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const resolvePaymentProvider = () => {
  if (["nowpayments", "coinbase", "static"].includes(paymentProviderSetting)) {
    return paymentProviderSetting;
  }
  if (nowPaymentsApiKey) return "nowpayments";
  if (coinbaseApiKey) return "coinbase";
  return "static";
};

const nowPaymentsCurrencyMap = {
  BTC: "btc",
  ETH: "eth",
  USDT_TRC20: "usdttrc20",
  USDT_ERC20: "usdterc20",
};

const adminUsername = String(process.env.ADMIN_USERNAME || "admin").trim();
const adminPassword = String(process.env.ADMIN_PASSWORD || "").trim();
const adminSessionSecret = () =>
  String(
    process.env.ADMIN_SESSION_SECRET ||
      process.env.ADMIN_SECRET_PASSPHRASE ||
      "zonex-change-this-session-secret"
  );

const ADMIN_COOKIE = "zonex_admin_session";
const ADMIN_SESSION_MS = 24 * 60 * 60 * 1000;

const safeEqual = (a, b) => {
  const left = String(a);
  const right = String(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
};

const parseCookies = (req) => {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(";").forEach((part) => {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    out[key] = decodeURIComponent(val);
  });
  return out;
};

const createAdminSessionToken = (username) => {
  const exp = Date.now() + ADMIN_SESSION_MS;
  const body = JSON.stringify({ u: username, exp });
  const sig = crypto.createHmac("sha256", adminSessionSecret()).update(body).digest("hex");
  return `${Buffer.from(body).toString("base64url")}.${sig}`;
};

const verifyAdminSessionToken = (token) => {
  if (!token || !String(token).includes(".")) return null;
  const [bodyB64, sig] = String(token).split(".");
  try {
    const body = Buffer.from(bodyB64, "base64url").toString("utf8");
    const expected = crypto.createHmac("sha256", adminSessionSecret()).update(body).digest("hex");
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    const data = JSON.parse(body);
    if (!data.u || Date.now() > Number(data.exp)) return null;
    return data.u;
  } catch {
    return null;
  }
};

const getAdminSessionUser = (req) => {
  const cookies = parseCookies(req);
  const fromCookie = verifyAdminSessionToken(cookies[ADMIN_COOKIE]);
  if (fromCookie) return fromCookie;

  const legacy = req.headers["x-zone-admin-authorization"];
  if (legacy && adminPassword && safeEqual(legacy, adminPassword)) return adminUsername;
  if (legacy && process.env.ADMIN_SECRET_PASSPHRASE && safeEqual(legacy, process.env.ADMIN_SECRET_PASSPHRASE)) {
    return adminUsername;
  }
  return null;
};

const setAdminSessionCookie = (res, username) => {
  const token = createAdminSessionToken(username);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ADMIN_SESSION_MS / 1000)}${secure}`
  );
};

const clearAdminSessionCookie = (res) => {
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
};

const requireAdminApi = (req, res, next) => {
  if (!adminPassword) {
    return res.status(503).json({
      error: "Admin login is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env",
    });
  }
  if (!getAdminSessionUser(req)) {
    return res.status(401).json({ error: "Not logged in. Sign in at /admin/login.html" });
  }
  next();
};

const LICENSE_UNIT_USD = 200;

const MOCK_ANALYTICS_LICENSES = [
  { created_at: "2026-05-29T14:22:00Z", mt5_account: "774102", email: "alpha.trader@gmail.com", payment_status: "confirmed", crypto_amount_expected: 200 },
  { created_at: "2026-05-28T09:15:00Z", mt5_account: "551029", email: "kvn.fx@quant.io", payment_status: "confirmed", crypto_amount_expected: 200.42 },
  { created_at: "2026-05-15T18:40:00Z", mt5_account: "110294", email: "v.s@we-trade.lt", payment_status: "confirmed", crypto_amount_expected: 200.17 },
  { created_at: "2026-04-20T11:02:00Z", mt5_account: "334910", email: "operator@capitaldesk.com", payment_status: "confirmed", crypto_amount_expected: 200.08 },
];

const aggregateLicenseMetrics = (rows, { mockMode = false } = {}) => {
  const list = Array.isArray(rows) ? rows : [];
  let totalRevenue = 0;
  const monthlyMap = new Map();

  list.forEach((item) => {
    const amount = Number(item.crypto_amount_expected) || LICENSE_UNIT_USD;
    totalRevenue += amount;
    const date = new Date(item.created_at);
    const monthLabel = date.toLocaleString("en-US", { month: "long", year: "numeric" });
    const sortKey = date.getFullYear() * 12 + date.getMonth();
    if (!monthlyMap.has(monthLabel)) {
      monthlyMap.set(monthLabel, { month: monthLabel, revenue: 0, sales: 0, sortKey });
    }
    const bucket = monthlyMap.get(monthLabel);
    bucket.revenue = Number((bucket.revenue + amount).toFixed(2));
    bucket.sales += 1;
  });

  const monthlyBreakdown = Array.from(monthlyMap.values())
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ month, revenue, sales }) => ({ month, revenue, sales }));

  const recentActivity = [...list]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map((item) => ({
      mt5_account: String(item.mt5_account || ""),
      email: String(item.email || ""),
      status: String(item.payment_status || "confirmed").toUpperCase(),
      timestamp: item.created_at,
    }));

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalLicenses: list.length,
    monthlyBreakdown,
    recentActivity,
    mockMode,
  };
};

const extractWebhookMetadata = (eventData = {}) => {
  const metadata = eventData.metadata || {};
  const userEmail = String(metadata.email || "").trim().toLowerCase();
  const mt5Account = String(metadata.mt5_account || "").trim();
  return { userEmail, mt5Account };
};

const verifyWebhookSignature = (rawBody, signatureHeader) => {
  if (!signatureHeader || !webhookSecret) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const incoming = String(signatureHeader).trim();
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(incoming));
  } catch {
    return false;
  }
};

const sortObjectForNowPayments = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      const nested = value[key];
      result[key] =
        nested && typeof nested === "object" && !Array.isArray(nested)
          ? sortObjectForNowPayments(nested)
          : nested;
      return result;
    }, {});
};

const verifyNowPaymentsIpnSignature = (payload, signatureHeader) => {
  if (!signatureHeader || !nowPaymentsIpnSecret || !payload || typeof payload !== "object") {
    return false;
  }
  const expected = crypto
    .createHmac("sha512", nowPaymentsIpnSecret)
    .update(JSON.stringify(sortObjectForNowPayments(payload)))
    .digest("hex");
  const incoming = String(signatureHeader).trim();
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(incoming));
  } catch {
    return false;
  }
};

const buildPublicSiteUrl = (req) => {
  const configured = String(process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) {
    return configured;
  }
  return `${req.protocol}://${req.get("host")}`;
};

const sendTelegramMessage = async (payload, targetType) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("Telegram relay is not configured.");
  }

  let messageText = "\n// NEW ZONEX TELEMETRY INTAKE\n";
  messageText += "━━━━━━━━━━━━━━━━━━━━\n";
  messageText += `TARGET: ${targetType}\n`;
  Object.keys(payload).forEach((key) => {
    messageText += `${key.toUpperCase()}: ${payload[key]}\n`;
  });
  messageText += "━━━━━━━━━━━━━━━━━━━━";

  const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(telegramUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: messageText,
    }),
  });

  if (!response.ok) {
    throw new Error("Telegram relay rejected payload.");
  }
};

const writeSupabaseRelay = async (payload, targetType) => {
  if (!hasSupabase) {
    throw new Error("Supabase is not configured.");
  }
  const tableName = targetType === "terminal" ? "terminal_leads" : "inquiries";
  const { error } = await supabase.from(tableName).insert(payload);
  if (error) {
    throw new Error(`Supabase relay failed for ${tableName}.`);
  }
};

const dispatchAccessPackage = async (email, mt5Account, txHash, activationTokenOverride = null) => {
  if (!resend) {
    console.warn("[Fulfillment Warning] RESEND_API_KEY missing. Suppressing delivery sequence.");
    return false;
  }

  const activationToken = activationTokenOverride || buildActivationToken(mt5Account, txHash);
  const isPartnerFlow = String(txHash || "").startsWith("PARTNER_VIGCO_");

  const appUrl = process.env.APP_URL || "https://yourdomain.com";
  const timestampUtc = new Date().toISOString().replace("T", " ").substring(0, 19);

  const introCopy = isPartnerFlow
    ? "Your partner broker registration has been verified. ZoneX Bot is now bound to your MT5 account. Use the token below to download the EA and complete onboarding."
    : "Your payment has cleared. The engine is bound to your MT5 account. Use the token below to download the EA and complete onboarding.";

  const emailTemplate = `
    <div style="background-color:#050505;color:#ffffff;font-family:monospace;padding:40px;border:1px solid #111111;max-width:600px;margin:0 auto;">
      <div style="border-bottom:1px solid #161616;padding-bottom:20px;">
        <span style="color:#00ff7f;font-size:11px;letter-spacing:2px;">// ZONEX LICENSE PROVISIONING</span>
        <h1 style="font-weight:300;font-size:20px;margin-top:5px;color:#ffffff;">TERMINAL ACTIVATION COMPLETE</h1>
      </div>
      <p style="font-size:13px;color:#888888;line-height:1.6;">
        ${introCopy}
      </p>
      <div style="background-color:#090909;border:1px solid #161616;padding:20px;margin:25px 0;border-radius:4px;">
        <table style="width:100%;font-size:12px;color:#aaaaaa;">
          <tr><td style="padding:4px 0;color:#555555;">TARGET INSTRUMENT:</td><td style="padding:4px 0;color:#00ff7f;font-weight:bold;">XAUUSD (SPOT GOLD) ONLY</td></tr>
          <tr><td style="padding:4px 0;color:#555555;">HARDWARE ANCHOR:</td><td style="padding:4px 0;color:#ffffff;">MT5 ACCOUNT #${mt5Account}</td></tr>
          <tr><td style="padding:4px 0;color:#555555;">SECURITY TOKEN:</td><td style="padding:4px 0;color:#ffffff;font-weight:bold;">${activationToken}</td></tr>
          <tr><td style="padding:4px 0;color:#555555;">TX ANCHOR:</td><td style="padding:4px 0;color:#333333;font-size:10px;">${txHash}</td></tr>
        </table>
      </div>
      <h3 style="font-size:13px;font-weight:normal;color:#ffffff;margin-top:25px;">NEXT STEPS FOR CORE DEPLOYMENT:</h3>
      <ol style="font-size:12px;color:#888888;padding-left:20px;line-height:1.8;">
        <li>Download the compiled engine package: <a href="${appUrl}/api/download/engine?token=${activationToken}" style="color:#00ff7f;text-decoration:none;border-bottom:1px dotted #00ff7f;">Get ZoneX_XAUUSD.ex5</a></li>
        <li>Transfer the binary directly into your MetaTrader 5 <code style="color:#ffffff;">MQL5/Experts</code> directory hierarchy.</li>
        <li>Ensure WebRequest authorization is active for telemetry validation endpoints.</li>
      </ol>
      <div style="border-top:1px solid #161616;margin-top:40px;padding-top:20px;font-size:10px;color:#444444;text-align:center;">
        SYSTEM TIMESTAMP: ${timestampUtc} UTC<br/>
        This is an automated data stream transmission. Do not reply directly to this telemetry relay.
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "ZoneX Operations <operations@yourdomain.com>",
      to: [email],
      subject: `[SYSTEM] EX5 Engine Provisioned - MT5 #${mt5Account}`,
      html: emailTemplate,
    });
    console.log(`[Fulfillment] Access package delivered to ${email}`);
    return true;
  } catch (deliveryError) {
    console.error("[Fulfillment Error] Failed to route secure welcome package:", deliveryError);
    return false;
  }
};

const fulfillConfirmedPayment = async ({ email, mt5Account, txHash, eventId = null }) => {
  if (!hasSupabase) {
    throw new Error("Supabase is not configured for fulfillment updates.");
  }

  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanMt5 = String(mt5Account || "").trim();
  const finalTxHash = String(txHash || "MOCK_TX_VALIDATED").trim();
  const activationToken = buildActivationToken(cleanMt5, finalTxHash);
  const eventKey = String(eventId || `${cleanEmail}:${cleanMt5}:${finalTxHash}`);

  const { data: success, error: rpcError } = await supabase.rpc("fulfill_payment", {
    p_event_id: eventKey,
    p_email: cleanEmail,
    p_mt5: cleanMt5,
    p_token: activationToken,
    p_tx_hash: finalTxHash,
  });

  if (rpcError) {
    throw new Error(rpcError.message || "Database state transition failed.");
  }

  if (!success) {
    return { duplicate: true, activationToken };
  }

  return { duplicate: false, activationToken };
};

const createCoinbaseCharge = async ({ req, metadata, amountUsd }) => {
  const chargePayload = {
    name: "ZoneX Terminal Activation",
    description: "Lifetime License Asset Secure Provisioning - XAUUSD Monotarget Engine",
    pricing_type: "fixed_price",
    local_price: {
      amount: amountUsd.toFixed(2),
      currency: "USD",
    },
    metadata: {
      ...metadata,
      asset_lock: "XAUUSD",
    },
    redirect_url: `${buildPublicSiteUrl(req)}/terminal/onboarding`,
    cancel_url: `${buildPublicSiteUrl(req)}/checkout`,
  };

  const providerResponse = await fetch("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": coinbaseApiKey,
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify(chargePayload),
  });
  const resultData = await providerResponse.json();

  if (!providerResponse.ok) {
    throw new Error(resultData?.error?.message || "External Gateway Rejection");
  }

  return {
    mockMode: false,
    provider: "coinbase",
    chargeId: resultData?.data?.id,
    hostedUrl: resultData?.data?.hosted_url,
    providerMetadata: chargePayload.metadata,
  };
};

const createNowPaymentsInvoice = async ({ req, metadata, amountUsd, licenseId, payCurrency }) => {
  const payCurrencyCode = nowPaymentsCurrencyMap[payCurrency];
  if (!payCurrencyCode) {
    throw new Error(`Unsupported NOWPayments currency mapping for ${payCurrency}.`);
  }

  const siteUrl = buildPublicSiteUrl(req);
  const invoicePayload = {
    price_amount: Number(amountUsd.toFixed(2)),
    price_currency: "usd",
    pay_currency: payCurrencyCode,
    order_id: String(licenseId),
    order_description: `ZoneX Bot license · MT5 #${metadata.mt5_account} · ${metadata.email}`,
    ipn_callback_url: `${siteUrl}/api/webhooks/nowpayments`,
    success_url: `${siteUrl}/terminal/onboarding?checkoutId=${encodeURIComponent(String(licenseId))}`,
    cancel_url: `${siteUrl}/checkout`,
    is_fixed_rate: true,
    is_fee_paid_by_user: false,
  };

  const providerResponse = await fetch(`${nowPaymentsApiBase}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": nowPaymentsApiKey,
    },
    body: JSON.stringify(invoicePayload),
  });
  const resultData = await providerResponse.json();

  if (!providerResponse.ok) {
    throw new Error(resultData?.message || resultData?.error || "NOWPayments invoice creation failed.");
  }

  const hostedUrl = resultData?.invoice_url || resultData?.url;
  if (!hostedUrl) {
    throw new Error("NOWPayments did not return a hosted invoice URL.");
  }

  return {
    mockMode: false,
    provider: "nowpayments",
    chargeId: String(resultData?.id || resultData?.token_id || ""),
    hostedUrl,
    providerMetadata: {
      ...metadata,
      asset_lock: "XAUUSD",
      order_id: String(licenseId),
    },
  };
};

const createPaymentSession = async ({ req, metadata, amountUsd, licenseId, payCurrency }) => {
  const provider = resolvePaymentProvider();

  if (provider === "nowpayments") {
    if (!nowPaymentsApiKey) {
      throw new Error("NOWPAYMENTS_API_KEY is missing.");
    }
    return createNowPaymentsInvoice({ req, metadata, amountUsd, licenseId, payCurrency });
  }

  if (provider === "coinbase") {
    if (!coinbaseApiKey) {
      throw new Error("COINBASE_API_KEY is missing.");
    }
    return createCoinbaseCharge({ req, metadata, amountUsd });
  }

  return {
    mockMode: false,
    provider: "static",
    chargeId: null,
    hostedUrl: null,
    providerMetadata: metadata,
  };
};

// Keep webhook routes before express.json so raw / signed body checks work.
app.post("/api/webhooks/nowpayments", express.json(), async (req, res) => {
  const signature = req.headers["x-nowpayments-sig"];
  if (!verifyNowPaymentsIpnSignature(req.body, signature)) {
    return res.status(401).json({ error: "Missing or invalid NOWPayments IPN signature." });
  }

  const paymentStatus = String(req.body?.payment_status || "").toLowerCase();
  const paymentId = req.body?.payment_id;
  const orderId = String(req.body?.order_id || "").trim();

  if (!["finished", "confirmed"].includes(paymentStatus)) {
    return res.status(200).json({ received: true, status: paymentStatus || "ignored" });
  }

  if (relayMode !== "supabase") {
    return res.status(200).json({ received: true, mode: "mock" });
  }

  if (!orderId || !paymentId) {
    return res.status(400).json({ error: "NOWPayments IPN missing order_id or payment_id." });
  }

  try {
    const { data: license, error: licenseLookupError } = await supabase
      .from("licenses")
      .select("email, mt5_account, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (licenseLookupError) throw licenseLookupError;
    if (!license) {
      throw new Error(`No checkout intent found for order_id ${orderId}.`);
    }

    const txHash = String(
      req.body?.payin_hash ||
        req.body?.outcome_hash ||
        req.body?.purchase_id ||
        paymentId
    );
    const eventId = `nowpayments:${paymentId}`;

    const result = await fulfillConfirmedPayment({
      email: license.email,
      mt5Account: license.mt5_account,
      txHash,
      eventId,
    });

    if (result.duplicate) {
      return res.status(200).json({ received: true, note: "Idempotency guard active. Duplicate bypassed." });
    }

    const delivered = await dispatchAccessPackage(
      license.email,
      license.mt5_account,
      txHash,
      result.activationToken
    );
    if (!delivered) {
      console.error("[NOWPayments IPN] DB updated, but Resend failed to deliver email.");
    }

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const alertMessage =
        "PAYMENT CONFIRMED (NOWPayments)\n" +
        "━━━━━━━━━━━━━━━━━━━━\n" +
        `OPERATOR: ${license.email}\n` +
        `TERMINAL ID: ${license.mt5_account}\n` +
        `PAYMENT ID: ${paymentId}\n` +
        "ASSET LOCK: XAUUSD ONLY\n" +
        "PROVISIONING: ACCESS GRANTED\n" +
        `TX HASH: ${txHash || "N/A"}\n` +
        "━━━━━━━━━━━━━━━━━━━━";

      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: alertMessage,
        }),
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[NOWPayments IPN]", err.message);
    return res.status(500).json({ error: err.message || "NOWPayments fulfillment failed." });
  }
});

app.post("/api/webhooks/crypto-billing", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-cc-webhook-signature"];
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(401).json({ error: "Missing or invalid cryptographic signature." });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid webhook payload." });
  }

  const eventType = event?.event?.type;
  const eventData = event?.event?.data || {};
  const { userEmail, mt5Account } = extractWebhookMetadata(eventData);

  if (!eventType) {
    return res.status(400).json({ error: "Missing event type." });
  }

  if (eventType !== "charge:confirmed") {
    return res.status(200).json({ received: true });
  }

  if (relayMode !== "supabase") {
    return res.status(200).json({ received: true, mode: "mock" });
  }

  try {
    if (!userEmail || !mt5Account) {
      throw new Error("Webhook metadata missing email or mt5_account.");
    }

    const txHash = eventData?.payments?.[0]?.network_tx_id || "MOCK_TX_VALIDATED";
    const eventId = event?.event?.id || event?.id || eventData?.id || `${userEmail}:${mt5Account}:${txHash}`;

    const result = await fulfillConfirmedPayment({
      email: userEmail,
      mt5Account,
      txHash,
      eventId,
    });

    if (result.duplicate) {
      return res.status(200).json({ received: true, note: "Idempotency guard active. Duplicate bypassed." });
    }

    const delivered = await dispatchAccessPackage(
      userEmail,
      mt5Account,
      txHash,
      result.activationToken
    );
    if (!delivered) {
      console.error("[Webhook Fulfillment] DB updated, but Resend failed to deliver email.");
    }

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const alertMessage =
        "PAYMENT CONFIRMED\n" +
        "━━━━━━━━━━━━━━━━━━━━\n" +
        `OPERATOR: ${userEmail}\n` +
        `TERMINAL ID: ${mt5Account}\n` +
        "ASSET LOCK: XAUUSD ONLY\n" +
        "PROVISIONING: ACCESS GRANTED\n" +
        `TX HASH: ${txHash || "N/A"}\n` +
        "━━━━━━━━━━━━━━━━━━━━";

      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: alertMessage,
        }),
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[Webhook Fulfillment]", err.message);
    return res.status(500).json({ error: err.message || "Database state transition failed." });
  }
});

app.get("/api/download/engine", async (req, res) => {
  try {
    const token = String(req.query.token || "").trim().toUpperCase();
    if (!token || token.length !== 16) {
      return res.status(403).json({
        error: "Access Vector Denied",
        details: "Malformed or missing secure authentication token.",
      });
    }

    const secureStoragePath = path.join(__dirname, "secure_assets", "ZoneX_XAUUSD.ex5");
    if (!fs.existsSync(secureStoragePath)) {
      return res.status(500).json({ error: "Requested binary package temporarily offline." });
    }

    if (relayMode === "supabase") {
      if (!hasSupabase) {
        return res.status(500).json({ error: "Supabase is not configured for token validation." });
      }

      const { data: lead, error } = await supabase
        .from("terminal_leads")
        .select("mt5_account, access_granted, payment_status")
        .eq("activation_token", token)
        .maybeSingle();

      if (error || !lead || !lead.access_granted || lead.payment_status !== "CONFIRMED") {
        return res.status(403).json({
          error: "Deployment token invalid or access has been suspended.",
        });
      }

      console.log(
        `[Fulfillment Access] Token ${token} unlocked ZoneX_XAUUSD.ex5 for MT5 Terminal #${lead.mt5_account}`
      );
    } else if (process.env.NODE_ENV !== "production") {
      console.log(`[Fulfillment Debug] Local token validation fallback check for token: ${token}`);
    } else {
      return res.status(401).json({ error: "Cryptographic Access Verification Failure." });
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", 'attachment; filename="ZoneX_XAUUSD.ex5"');
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    fs.createReadStream(secureStoragePath).pipe(res);
  } catch (controllerError) {
    console.error("[Critical Download Failure]", controllerError);
    return res.status(500).json({ error: "Internal secure asset transmission error." });
  }
});

app.get("/api/license/verify", async (req, res) => {
  try {
    const accountId = String(req.query.account || req.headers["x-terminal-account"] || "").trim();
    if (!accountId) {
      return res.status(400).json({
        status: "AUTH_FAILED",
        reason: "Missing hardware terminal anchor account.",
      });
    }

    let isAuthorized = false;

    if (relayMode === "supabase") {
      if (!hasSupabase) {
        return res.status(500).json({ status: "ERROR", reason: "Internal ledger validation latency." });
      }

      const { data, error } = await supabase
        .from("terminal_leads")
        .select("mt5_account,payment_status,access_granted")
        .eq("mt5_account", accountId)
        .eq("payment_status", "CONFIRMED")
        .eq("access_granted", true)
        .limit(1)
        .maybeSingle();

      if (error) {
        return res.status(500).json({ status: "ERROR", reason: "Internal ledger validation latency." });
      }

      if (data) {
        isAuthorized = true;
      }
    } else if (accountId === "123456" || process.env.NODE_ENV !== "production") {
      isAuthorized = true;
    }

    if (isAuthorized) {
      return res.status(200).json({
        status: "AUTHORIZED",
        asset_lock: "XAUUSD",
        timestamp_utc: new Date().toISOString(),
        signature: crypto
          .createHmac("sha256", process.env.CRYPTO_WEBHOOK_SECRET || "fallback")
          .update(accountId)
          .digest("hex"),
      });
    }

    return res.status(403).json({
      status: "UNAUTHORIZED",
      reason: "No active, confirmed license found for this hardware terminal profile.",
    });
  } catch (authError) {
    console.error("[Critical Auth Failure]", authError);
    return res.status(500).json({ status: "ERROR", reason: "System level validation exception." });
  }
});

app.get("/api/license/heartbeat", async (req, res) => {
  try {
    const accountId = String(req.query.account || req.headers["x-terminal-account"] || "").trim();
    const sessionToken = req.query.session;

    if (!accountId) {
      return res.status(400).json({ status: "TERMINATED", reason: "Missing hardware anchor." });
    }

    let isSessionValid = false;

    if (relayMode === "supabase") {
      if (!hasSupabase) {
        return res.status(500).json({
          status: "ACTIVE_RUNNING",
          warning: "Internal verification latency",
        });
      }

      const { data, error } = await supabase
        .from("terminal_leads")
        .select("payment_status, access_granted")
        .eq("mt5_account", accountId)
        .eq("payment_status", "CONFIRMED")
        .eq("access_granted", true)
        .maybeSingle();

      if (!error && data) {
        isSessionValid = true;
      }
    } else if (accountId === "123456" || process.env.NODE_ENV !== "production") {
      isSessionValid = true;
    }

    if (isSessionValid) {
      return res.status(200).json({
        status: "ACTIVE_RUNNING",
        server_time_utc: new Date().toISOString(),
        next_expected_ping_seconds: 3600,
        session_ack: sessionToken ? true : undefined,
      });
    }

    console.warn(
      `[REVOCATION EVENT] Runtime heartbeat failed for Account #${accountId}. Sending termination sequence.`
    );
    return res.status(403).json({
      status: "REVOKED",
      reason: "License state suspension or terminal de-authorization detected.",
    });
  } catch (heartbeatError) {
    console.error("[Heartbeat Processing Exception]", heartbeatError);
    return res.status(500).json({
      status: "ACTIVE_RUNNING",
      warning: "Internal verification latency",
    });
  }
});

app.use("/secure_assets", (_req, res) => {
  return res.status(403).json({ error: "Direct vault access denied." });
});

app.use(express.json());

app.get("/admin/login.html", (_req, res) => {
  res.sendFile(path.join(__dirname, "admin", "login.html"));
});

app.get("/admin/terminal.html", (req, res) => {
  if (!getAdminSessionUser(req)) {
    return res.redirect("/admin/login.html");
  }
  res.sendFile(path.join(__dirname, "admin", "terminal.html"));
});

app.get("/api/admin/session", (req, res) => {
  const user = getAdminSessionUser(req);
  if (!user) {
    return res.status(401).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true, username: user });
});

app.post("/api/admin/login", (req, res) => {
  if (!adminPassword) {
    return res.status(503).json({
      error: "Admin login not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env",
    });
  }

  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!safeEqual(username, adminUsername) || !safeEqual(password, adminPassword)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  setAdminSessionCookie(res, username);
  return res.status(200).json({ success: true, username });
});

app.post("/api/admin/logout", (req, res) => {
  clearAdminSessionCookie(res);
  return res.status(200).json({ success: true });
});

app.get("/api/admin/analytics", requireAdminApi, async (_req, res) => {
  try {
    if (relayMode === "supabase" && hasSupabase) {
      const { data, error } = await supabase
        .from("licenses")
        .select("created_at,payment_status,mt5_account,email,crypto_amount_expected")
        .in("payment_status", ["confirmed", "activated"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return res.status(200).json(aggregateLicenseMetrics(data || [], { mockMode: false }));
    }

    return res.status(200).json(aggregateLicenseMetrics(MOCK_ANALYTICS_LICENSES, { mockMode: true }));
  } catch (err) {
    console.error("[Admin Analytics]", err);
    return res.status(500).json({ error: "Database aggregation failed." });
  }
});

app.post("/api/admin/modify-access", requireAdminApi, async (req, res) => {
  try {
    const { account_id, status_action } = req.body || {};
    if (!account_id || !["ACTIVATE", "SUSPEND"].includes(status_action)) {
      return res.status(400).json({ error: "Malformed control parameters." });
    }

    const cleanAccount = String(account_id).trim();
    const isGranting = status_action === "ACTIVATE";

    if (relayMode === "supabase") {
      if (!hasSupabase) {
        return res.status(500).json({ error: "Supabase is not configured for admin operations." });
      }

      const { data: existingLead, error: lookupError } = await supabase
        .from("terminal_leads")
        .select("email, mt5_account, payment_status, access_granted, transaction_hash")
        .eq("mt5_account", cleanAccount)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!existingLead) {
        return res.status(404).json({ error: "No terminal lead found for this MT5 account." });
      }

      const activationToken =
        isGranting && existingLead.transaction_hash
          ? buildActivationToken(cleanAccount, existingLead.transaction_hash)
          : null;

      const { data, error } = await supabase
        .from("terminal_leads")
        .update({
          access_granted: isGranting,
          payment_status: isGranting ? "CONFIRMED" : "REVOKED",
          activation_token: activationToken,
        })
        .eq("mt5_account", cleanAccount)
        .select("email, mt5_account, payment_status, access_granted");

      if (error) throw error;

      const { error: licenseError } = await supabase
        .from("licenses")
        .update({
          payment_status: isGranting ? "confirmed" : "revoked",
        })
        .eq("mt5_account", cleanAccount);

      if (licenseError) throw licenseError;

      console.log(`[ADMIN CONTROL] Account #${cleanAccount} status modified to: ${status_action}`);
      return res.status(200).json({
        success: true,
        message: "Terminal state updated cleanly.",
        target: data,
      });
    }

    return res.status(200).json({
      success: true,
      mockMode: true,
      message: `[MOCK] Account ${cleanAccount} executed action: ${status_action}`,
    });
  } catch (adminError) {
    console.error("[Admin Operations Exception]", adminError);
    return res.status(500).json({ error: "Internal administrative pipeline lag." });
  }
});

app.get("/api/admin/lookup-operator", requireAdminApi, async (req, res) => {
  try {
    const accountId = req.query.account;

    if (!accountId) {
      return res.status(400).json({ error: "Missing target hardware terminal identity." });
    }

    const cleanAccount = String(accountId).trim();

    if (relayMode === "supabase") {
      if (!hasSupabase) {
        return res.status(500).json({ error: "Supabase is not configured for admin lookup." });
      }

      const { data, error } = await supabase
        .from("terminal_leads")
        .select("email, broker_id, mt5_account, payment_status, access_granted, created_at")
        .eq("mt5_account", cleanAccount)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({ error: "No record associated with this hardware signature." });
      }

      return res.status(200).json({ success: true, record: data });
    }

    return res.status(200).json({
      success: true,
      mockMode: true,
      record: {
        email: "operator_sandbox@onyx.agency",
        broker_id: "IC_MARKETS_RAW",
        mt5_account: cleanAccount,
        payment_status: "CONFIRMED",
        access_granted: true,
        created_at: new Date().toISOString(),
      },
    });
  } catch (lookupError) {
    console.error("[Admin Lookup Exception]", lookupError);
    return res.status(500).json({ error: "Internal database telemetry look-back failure." });
  }
});

app.use(express.static(path.join(__dirname)));

app.post("/api/license/provision", async (req, res) => {
  try {
    const { email, brokerId, broker_id, mt5Account, mt5_account, partner_registered } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanBrokerId = String(broker_id || brokerId || PARTNER_BROKER_ID).trim();
    const cleanMt5 = String(mt5_account || mt5Account || "").trim();
    const registered =
      partner_registered === true ||
      partner_registered === "true" ||
      partner_registered === "on" ||
      partner_registered === 1;

    if (!registered) {
      return res.status(400).json({
        error: "Confirm that you registered with the partner broker before requesting a license.",
      });
    }
    if (!cleanEmail || !cleanMt5) {
      return res.status(400).json({
        error: "Email and MT5 account number are required.",
      });
    }
    if (!isEmail(cleanEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (!/^\d{5,12}$/.test(cleanMt5)) {
      return res.status(400).json({
        error: "MT5 login should be a numeric account number (5-12 digits).",
      });
    }

    const txHash = partnerTxHash(cleanMt5);
    const activationToken = buildActivationToken(cleanMt5, txHash);
    const timestampUtc = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
    const onboardingUrl = `/terminal/onboarding?token=${encodeURIComponent(activationToken)}&account=${encodeURIComponent(cleanMt5)}`;

    if (!hasSupabase) {
      await dispatchAccessPackage(cleanEmail, cleanMt5, txHash).catch(() => false);
      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text:
              "PARTNER LICENSE PROVISIONED (MOCK)\n" +
              `EMAIL: ${cleanEmail}\n` +
              `MT5: ${cleanMt5}\n` +
              `TOKEN: ${activationToken}`,
          }),
        });
      }
      return res.status(200).json({
        success: true,
        mockMode: true,
        activationToken,
        onboardingUrl,
        partnerRegistrationUrl: PARTNER_REGISTRATION_URL,
      });
    }

    const leadPayload = {
      email: cleanEmail,
      broker_id: cleanBrokerId,
      mt5_account: cleanMt5,
      currency: "PARTNER",
      source_stream: "partner_vigco",
      timestamp_utc: timestampUtc,
      payment_status: "CONFIRMED",
      access_granted: true,
      transaction_hash: txHash,
      activation_token: activationToken,
    };

    const { data: existingLead } = await supabase
      .from("terminal_leads")
      .select("id,mt5_account,access_granted")
      .eq("mt5_account", cleanMt5)
      .maybeSingle();

    if (existingLead?.access_granted) {
      const { error: updateLeadError } = await supabase
        .from("terminal_leads")
        .update({
          email: cleanEmail,
          broker_id: cleanBrokerId,
          payment_status: "CONFIRMED",
          access_granted: true,
          transaction_hash: txHash,
          activation_token: activationToken,
          timestamp_utc: timestampUtc,
        })
        .eq("mt5_account", cleanMt5);

      if (updateLeadError) {
        return res.status(500).json({ error: "Could not refresh license for this MT5 account." });
      }
    } else {
      const { error: insertLeadError } = await supabase.from("terminal_leads").insert(leadPayload);
      if (insertLeadError) {
        if (String(insertLeadError.message || "").toLowerCase().includes("duplicate")) {
          return res.status(409).json({
            error: "This MT5 account is already registered. Contact support if you need help.",
          });
        }
        return res.status(500).json({ error: "Could not save your license request." });
      }
    }

    const { data: existingLicense } = await supabase
      .from("licenses")
      .select("id,payment_status")
      .eq("mt5_account", cleanMt5)
      .maybeSingle();

    const licenseRow = {
      email: cleanEmail,
      broker_id: cleanBrokerId,
      mt5_account: cleanMt5,
      payment_status: "confirmed",
      crypto_currency: "PARTNER",
      crypto_network: "VIGCO",
      wallet_address: PARTNER_REGISTRATION_URL,
      crypto_amount_expected: 0,
      unique_offset_cents: 0,
      tx_hash: txHash,
    };

    if (existingLicense) {
      const { error: licenseUpdateError } = await supabase
        .from("licenses")
        .update(licenseRow)
        .eq("mt5_account", cleanMt5);
      if (licenseUpdateError) {
        return res.status(500).json({ error: "Could not update license record." });
      }
    } else {
      const { error: licenseInsertError } = await supabase.from("licenses").insert(licenseRow);
      if (licenseInsertError) {
        if (!String(licenseInsertError.message || "").toLowerCase().includes("duplicate")) {
          return res.status(500).json({ error: "Could not create license record." });
        }
      }
    }

    await dispatchAccessPackage(cleanEmail, cleanMt5, txHash, activationToken);

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text:
            "PARTNER LICENSE PROVISIONED\n" +
            "━━━━━━━━━━━━━━━━━━━━\n" +
            `EMAIL: ${cleanEmail}\n` +
            `MT5: ${cleanMt5}\n` +
            `BROKER REF: ${cleanBrokerId}\n` +
            `REGISTRATION: ${PARTNER_REGISTRATION_URL}\n` +
            "━━━━━━━━━━━━━━━━━━━━",
        }),
      });
    }

    return res.status(200).json({
      success: true,
      activationToken,
      onboardingUrl,
      partnerRegistrationUrl: PARTNER_REGISTRATION_URL,
    });
  } catch (err) {
    return res.status(500).json({
      error: "License provisioning failed.",
      details: err.message || "Unexpected server error.",
    });
  }
});

app.get("/api/config/public", (_req, res) => {
  return res.status(200).json({
    siteUrl: SITE_URL,
    checkoutUrl: `${SITE_URL}/checkout`,
    partnerRegistrationUrl: PARTNER_REGISTRATION_URL,
    partnerBrokerId: PARTNER_BROKER_ID,
    telegramOfficialUrl: TELEGRAM_OFFICIAL_URL,
    telegramResultsUrl: TELEGRAM_RESULTS_URL,
    telegramOwnerUrl: TELEGRAM_OWNER_URL,
  });
});

app.post("/api/checkout/initialize", async (req, res) => {
  try {
    const {
      email,
      brokerId,
      broker_id,
      mt5Account,
      mt5_account,
      currency,
      partner_registered,
    } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanBrokerId = String(broker_id || brokerId || PARTNER_BROKER_ID).trim();
    const cleanMt5 = String(mt5_account || mt5Account || "").trim();
    const cleanCurrency = String(currency || "BTC").toUpperCase();
    const registered =
      partner_registered === true ||
      partner_registered === "true" ||
      partner_registered === "on" ||
      partner_registered === 1;

    if (!registered) {
      return res.status(400).json({
        error: "Confirm partner broker registration before paying for your license.",
      });
    }
    if (!cleanEmail || !cleanMt5) {
      return res.status(400).json({
        error: "Email and MT5 account number are required.",
      });
    }
    if (!isEmail(cleanEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (!/^\d{5,12}$/.test(cleanMt5)) {
      return res.status(400).json({
        error: "MT5 login should be a numeric account number (5-12 digits).",
      });
    }
    if (!walletByCurrency[cleanCurrency]) {
      return res.status(400).json({ error: "Unsupported payment currency/network." });
    }

    const offset = amountOffset();
    const expectedAmount = Number((200 + offset).toFixed(2));
    const walletAddress = walletByCurrency[cleanCurrency];
    const timestampUtc = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
    const metadata = {
      email: cleanEmail,
      broker_id: cleanBrokerId,
      mt5_account: cleanMt5,
      partner_flow: "vigco",
    };

    if (!hasSupabase) {
      const mockCheckoutId = `mock_${crypto.randomBytes(6).toString("hex")}`;
      return res.status(200).json({
        success: true,
        mockMode: true,
        checkoutId: mockCheckoutId,
        paymentStatus: "pending",
        amountExpected: expectedAmount,
        currency: cleanCurrency,
        network: networkByCurrency[cleanCurrency],
        walletAddress,
        hosted_url: `/terminal/onboarding?status=mock_activated&account=${encodeURIComponent(cleanMt5)}`,
      });
    }

    const leadPayload = {
      email: cleanEmail,
      broker_id: cleanBrokerId,
      mt5_account: cleanMt5,
      currency: cleanCurrency,
      source_stream: "partner_vigco_checkout",
      timestamp_utc: timestampUtc,
      payment_status: "PENDING",
      access_granted: false,
    };

    const { data: existingLead } = await supabase
      .from("terminal_leads")
      .select("id,access_granted,payment_status")
      .eq("mt5_account", cleanMt5)
      .maybeSingle();

    if (existingLead?.access_granted) {
      return res.status(409).json({
        error: "This MT5 account already has an active license.",
      });
    }

    if (existingLead) {
      await supabase
        .from("terminal_leads")
        .update({ ...leadPayload, payment_status: "PENDING", access_granted: false })
        .eq("mt5_account", cleanMt5);
    } else {
      const { error: leadInsertError } = await supabase.from("terminal_leads").insert(leadPayload);
      if (leadInsertError && !String(leadInsertError.message || "").toLowerCase().includes("duplicate")) {
        return res.status(500).json({ error: "Could not register terminal lead for checkout." });
      }
    }

    const { data, error } = await supabase
      .from("licenses")
      .insert({
        email: cleanEmail,
        broker_id: cleanBrokerId,
        mt5_account: cleanMt5,
        payment_status: "pending",
        crypto_currency: cleanCurrency,
        crypto_network: networkByCurrency[cleanCurrency],
        wallet_address: walletAddress,
        crypto_amount_expected: expectedAmount,
        unique_offset_cents: Math.round(offset * 100),
      })
      .select("id,email,broker_id,mt5_account,payment_status,crypto_amount_expected,crypto_currency,crypto_network,wallet_address,created_at")
      .single();

    if (error) {
      if (String(error.message || "").toLowerCase().includes("duplicate")) {
        return res.status(409).json({
          error: "This MT5 account is already registered. Contact support if this is unexpected.",
        });
      }
      return res.status(500).json({ error: "Could not initialize checkout intent." });
    }

    const providerResult = await createPaymentSession({
      req,
      metadata,
      amountUsd: expectedAmount,
      licenseId: data.id,
      payCurrency: cleanCurrency,
    });

    return res.status(200).json({
      success: true,
      mockMode: providerResult.mockMode,
      paymentProvider: providerResult.provider || resolvePaymentProvider(),
      hosted_url: providerResult.hostedUrl,
      charge_id: providerResult.chargeId,
      providerMetadata: providerResult.providerMetadata,
      checkoutId: data.id,
      paymentStatus: data.payment_status,
      amountExpected: Number(data.crypto_amount_expected),
      currency: data.crypto_currency,
      network: data.crypto_network,
      walletAddress: data.wallet_address,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Fulfillment Initialization Interrupted",
      details: err.message || "Unexpected server error.",
    });
  }
});

app.get("/api/checkout/status/:id", async (req, res) => {
  const { id } = req.params;
  if (String(id).startsWith("mock_")) {
    return res.status(200).json({ checkoutId: id, paymentStatus: "pending", mockMode: true });
  }
  if (!hasSupabase) {
    return res.status(500).json({
      error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const { data, error } = await supabase
    .from("licenses")
    .select("id,payment_status,mt5_account,tx_hash,email")
    .eq("id", id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Checkout intent not found." });
  }

  const payload = {
    checkoutId: data.id,
    paymentStatus: data.payment_status,
    mt5Account: data.mt5_account,
  };

  if (data.payment_status === "confirmed" && data.mt5_account) {
    const { data: lead } = await supabase
      .from("terminal_leads")
      .select("activation_token, transaction_hash")
      .eq("mt5_account", data.mt5_account)
      .maybeSingle();

    payload.activationToken =
      lead?.activation_token ||
      (data.tx_hash ? buildActivationToken(data.mt5_account, data.tx_hash) : null);

    if (payload.activationToken) {
      payload.onboardingUrl = `/terminal/onboarding?token=${encodeURIComponent(payload.activationToken)}&account=${encodeURIComponent(data.mt5_account)}`;
    }
  }

  return res.status(200).json(payload);
});

app.post("/api/relay/submit", async (req, res) => {
  try {
    const { targetType, payload } = req.body || {};
    const normalizedTarget = String(targetType || "").trim();
    if (!["terminal", "inquiry"].includes(normalizedTarget)) {
      return res.status(400).json({ error: "Unsupported relay target." });
    }
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Missing relay payload." });
    }

    if (relayMode === "supabase") {
      await writeSupabaseRelay(payload, normalizedTarget);
    } else {
      await sendTelegramMessage(payload, normalizedTarget);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Relay transmission failed." });
  }
});

app.get("/checkout", (_req, res) => {
  res.sendFile(path.join(__dirname, "checkout.html"));
});

app.get("/contact", (_req, res) => {
  res.sendFile(path.join(__dirname, "contact.html"));
});

app.get("/checkout.html", (_req, res) => {
  res.redirect(301, "/checkout");
});

app.get("/terminal/onboarding", (req, res) => {
  res.sendFile(path.join(__dirname, "terminal", "onboarding.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

module.exports = app;

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`ZoneX server running at http://localhost:${port}`);
    if (adminPassword) {
      console.log(`Admin login: http://localhost:${port}/admin/login.html (user: ${adminUsername})`);
    } else {
      console.warn("Admin login disabled — set ADMIN_USERNAME and ADMIN_PASSWORD in .env");
    }
  });
}
