#!/usr/bin/env node
/**
 * Minimal HubSpot test script.
 *
 * Usage:
 *   1. In .env set HUBSPOT_PERSONAL_ACCESS_KEY=pat-xxxx (or HUBSPOT_ACCESS_TOKEN=...).
 *   2. From project root run: npm run hubspot:test
 *
 * It will:
 *   - Load .env
 *   - Call GET /crm/v3/objects/contacts?limit=1 with Bearer token
 *   - Print success or the error status/body snippet
 */

const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
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
  const token = getEnv("HUBSPOT_PERSONAL_ACCESS_KEY") || getEnv("HUBSPOT_ACCESS_TOKEN");
  if (!token) {
    console.log("HUBSPOT_PERSONAL_ACCESS_KEY (or HUBSPOT_ACCESS_TOKEN) is not set in .env.");
    process.exit(1);
  }

  const base = "https://api.hubapi.com";
  const url = `${base}/crm/v3/objects/contacts?limit=1`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (res.ok) {
      console.log("✅ HubSpot key works. Contacts API responded with 2xx.");
      try {
        const data = JSON.parse(text);
        const total = data.total != null ? data.total : (data.results && data.results.length);
        if (total != null) console.log("   Contacts returned:", total);
      } catch {
        // ignore JSON parse issues, response was still OK
      }
      process.exit(0);
    } else {
      console.log(`❌ HubSpot API error: HTTP ${res.status}`);
      console.log(text.slice(0, 300));
      process.exit(1);
    }
  } catch (e) {
    console.log("❌ Request failed:", e.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

