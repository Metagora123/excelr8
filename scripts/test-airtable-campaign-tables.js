#!/usr/bin/env node
/**
 * Quick script to test creating the two Airtable tables (Hitlist + Auto Like/Comment)
 * without running the full campaign flow.
 *
 * Usage (from project root):
 *   node scripts/test-airtable-campaign-tables.js
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

// Same schema as lib/campaign-manager-inline.ts
const HITLIST_TABLE_FIELDS = [
  { name: "Enrich_person", type: "multilineText" },
  { name: "Email", type: "email" },
  { name: "LinkedIn", type: "url" },
  { name: "Name", type: "singleLineText" },
  { name: "Title", type: "singleLineText" },
  { name: "Org", type: "multilineText" },
  { name: "Headline", type: "multilineText" },
  { name: "Summary", type: "multilineText" },
  { name: "Title_Experience", type: "multilineText" },
  { name: "Company_Experience", type: "multilineText" },
  { name: "Company_Domain", type: "multilineText" },
  { name: "Summary_Experience", type: "multilineText" },
  { name: "Location_Name", type: "singleLineText" },
  { name: "Last_Name", type: "singleLineText" },
  { name: "First_Name", type: "singleLineText" },
  { name: "Work_Email", type: "email" },
  { name: "Email_Final", type: "email" },
  { name: "Num_Followers", type: "number", options: { precision: 0 } },
  {
    name: "Lead_Scoring",
    type: "singleSelect",
    options: { choices: [{ name: "Hot" }, { name: "Warm" }, { name: "Cold" }] },
  },
  {
    name: "Tier",
    type: "singleSelect",
    options: { choices: [{ name: "A" }, { name: "B" }, { name: "C" }] },
  },
  { name: "Score", type: "number", options: { precision: 0 } },
  { name: "Reasoning", type: "multilineText" },
  { name: "Mobile_Phone_EMEA", type: "multilineText" },
  { name: "status", type: "singleLineText" },
];

// Currently Auto Like / Comment uses the same schema on purpose (n8n expects same fields)
const AUTO_LIKE_TABLE_FIELDS = [...HITLIST_TABLE_FIELDS];

async function createTable(baseId, token, name, fields) {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, fields }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Create table failed (${res.status}): ${text}`);
  }
  const data = JSON.parse(text);
  const tableId = data.id;
  const url = `https://airtable.com/${baseId}/${tableId}`;
  return { tableId, url };
}

async function main() {
  loadEnv();
  const baseId = getEnv("AIRTABLE_BASE_ID");
  const token = getEnv("AIRTABLE_API_KEY");
  if (!baseId || !token) {
    console.error("AIRTABLE_BASE_ID or AIRTABLE_API_KEY missing in .env");
    process.exit(1);
  }

  const suffix = `TEST-${Date.now()}`;
  console.log("Using base:", baseId);

  const hitlistName = `HITLIST-${suffix}`;
  const autoLikeName = `AUTO-LIKE-COMMENT-${suffix}`;

  console.log("Creating Hitlist table:", hitlistName);
  const hitlist = await createTable(baseId, token, hitlistName, HITLIST_TABLE_FIELDS);
  console.log("Hitlist table created:", hitlist);

  console.log("Creating Auto Like / Comment table:", autoLikeName);
  const autoLike = await createTable(baseId, token, autoLikeName, AUTO_LIKE_TABLE_FIELDS);
  console.log("Auto Like / Comment table created:", autoLike);

  console.log("\nOpen these URLs to inspect schemas:");
  console.log("  Hitlist:", hitlist.url);
  console.log("  Auto Like / Comment:", autoLike.url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

