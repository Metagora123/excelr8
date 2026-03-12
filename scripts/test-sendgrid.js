#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test that SENDGRID_API_KEY is valid AND send a real test email.
 *
 * Run from project root:
 *   node scripts/test-sendgrid.js
 */

const fs = require("fs");
const path = require("path");
const sgMail = require("@sendgrid/mail");

// -------- env helpers (your existing logic) --------

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    console.warn("No .env file found at", envPath);
    return;
  }
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function getEnv(key) {
  const raw = process.env[key];
  if (raw == null) return "";
  const s = String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

// -------- main test (key + email send) --------

async function main() {
  loadEnv();

  const apiKey = getEnv("SENDGRID_API_KEY");
  const fromEmail = getEnv("SENDGRID_FROM_EMAIL_2") || "info@excelr8today.com";
  const fromName = getEnv("SENDGRID_FROM_NAME") || "Excelr8 Test";

  console.log("SendGrid API key + email test\n");

  if (!apiKey) {
    console.log("  ✗ SENDGRID_API_KEY is not set in .env");
    process.exit(1);
  }

  console.log("  SENDGRID_API_KEY: set (" + (apiKey.startsWith("SG.") ? "SG.…" : "***") + ")");
  console.log("  SENDGRID_FROM_EMAIL:", fromEmail || "(not set)");
  console.log("  SENDGRID_FROM_NAME:", fromName || "(not set)");
  console.log("");

  // 1) Quick key validation (same as before) – optional but helpful
  try {
    const res = await fetch("https://api.sendgrid.com/v3/scopes", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.log("  ✗ Key check failed: HTTP", res.status);
      if (text) console.log("  Response:", text.slice(0, 200));
      process.exit(1);
    }

    const data = await res.json();
    console.log("  ✓ API key scopes loaded (", (data.scopes || []).length, "scopes )");
  } catch (err) {
    console.log("  ✗ Key check request failed:", err.message);
    process.exit(1);
  }

  // 2) Actually send a test email
  sgMail.setApiKey(apiKey);

  const msg = {
    to: "dr.dre021@gmail.com",
    from: { email: fromEmail, name: fromName },
    subject: "Excelr8 SendGrid test email",
    text: "This is a plain-text SendGrid test email from Excelr8.",
    html: "<p>This is a <strong>SendGrid</strong> test email from Excelr8.</p>",
  };

  try {
    console.log("\nSending test email to dr.dre021@gmail.com …");
    const [sendRes] = await sgMail.send(msg);
    console.log("  ✓ Email sent. Status:", sendRes.statusCode);
    console.log("  Headers:", sendRes.headers);
    console.log("\n✅ Done.");
  } catch (err) {
    console.error("\nSendGrid send error:");
    if (err.response) {
      console.error("  Status:", err.response.statusCode);
      console.error("  Body:", err.response.body);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});