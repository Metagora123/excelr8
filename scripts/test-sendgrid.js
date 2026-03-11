#!/usr/bin/env node
/**
 * Test that SENDGRID_API_KEY is set and accepted by SendGrid.
 * Does not send an email; only verifies the key.
 *
 * Run from project root: node scripts/test-sendgrid.js
 */

const fs = require("fs");
const path = require("path");

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

async function main() {
  loadEnv();

  const apiKey = getEnv("SENDGRID_API_KEY");
  const fromEmail = getEnv("SENDGRID_FROM_EMAIL") || "info@excelr8today.com";
  const fromName = getEnv("SENDGRID_FROM_NAME") || "Newsletter";

  console.log("SendGrid API key test\n");

  if (!apiKey) {
    console.log("  ✗ SENDGRID_API_KEY is not set in .env");
    console.log("\n  Add your key from https://app.sendgrid.com/settings/api_keys");
    console.log("  (Create a key with 'Mail Send' or 'Full Access'.)");
    process.exit(1);
  }

  console.log("  SENDGRID_API_KEY: set (" + (apiKey.startsWith("SG.") ? "SG.…" : "***") + ")");
  console.log("  SENDGRID_FROM_EMAIL:", fromEmail || "(not set)");
  console.log("  SENDGRID_FROM_NAME:", fromName || "(not set)");
  console.log("");
  console.log("  Note: Next.js loads .env only at server start. If the app still fails");
  console.log("  when sending, restart the dev server (stop and run npm run dev again).");
  console.log("  If you use .env.local, set SENDGRID_API_KEY there too (it overrides .env).");
  console.log("");

  try {
    // SendGrid: GET /v3/scopes returns the key's scopes if valid; 401 if invalid
    const res = await fetch("https://api.sendgrid.com/v3/scopes", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const scopes = data.scopes || [];
      const hasMailSend = scopes.some((s) => s === "mail.send" || s === "mail.batch.create");
      console.log("  ✓ API key is valid");
      if (scopes.length > 0) {
        console.log("  Scopes:", scopes.slice(0, 10).join(", ") + (scopes.length > 10 ? " …" : ""));
        if (!hasMailSend) {
          console.log("\n  ⚠️  Key may not have 'mail.send'. Newsletter send could still fail.");
          console.log("     Create a new key with 'Mail Send' at https://app.sendgrid.com/settings/api_keys");
        }
      }
      console.log("\n✅ SendGrid is ready. You can send from the Newsletter page.");
      return;
    }

    if (res.status === 401 || res.status === 403) {
      const text = await res.text();
      console.log("  ✗ SendGrid rejected the key (401/403 Unauthorized)");
      console.log("\n  Possible causes:");
      console.log("  - Key is wrong, expired, or deleted");
      console.log("  - Key was created without 'Mail Send' (or Full Access)");
      console.log("\n  Create a new API key at https://app.sendgrid.com/settings/api_keys");
      if (text) console.log("  Response:", text.slice(0, 200));
      process.exit(1);
    }

    console.log("  ✗ Unexpected response: HTTP", res.status);
    const text = await res.text();
    if (text) console.log("  Response:", text.slice(0, 300));
    process.exit(1);
  } catch (err) {
    console.log("  ✗ Request failed:", err.message);
    console.log("\n  Check your network and that api.sendgrid.com is reachable.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
