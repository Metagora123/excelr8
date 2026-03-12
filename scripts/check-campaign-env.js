#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Check that all env vars and external services needed for Campaign Manager
 * (simple n8n webhook + in-app flow with Supabase, Airtable, n8n API) are set and reachable.
 *
 * Run from project root: node scripts/check-campaign-env.js
 * Optional: node scripts/check-campaign-env.js --live  (pings Supabase, Airtable, n8n)
 */

const fs = require("fs");
const path = require("path");

// Load .env into process.env (simple parser: no dotenv dep)
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

const required = [
  // Supabase (at least one project for campaign creation)
  { key: "SUPABASE_URL", label: "Supabase URL" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase service role key" },
  // Airtable (create tables in base)
  { key: "AIRTABLE_API_KEY", label: "Airtable PAT (API key)" },
  { key: "AIRTABLE_BASE_ID", label: "Airtable base ID (campaign tables base)" },
  // n8n webhook (simple "Send to n8n" flow)
  { key: "N8N_WEBHOOK_URL", label: "n8n webhook base URL" },
  { key: "N8N_CAMPAIGN_TEST_ENDPOINT", label: "n8n campaign test endpoint" },
  { key: "N8N_CAMPAIGN_PROD_ENDPOINT", label: "n8n campaign prod endpoint" },
  // n8n API (in-app flow: duplicate workflows)
  { key: "N8N_API_URL", label: "n8n API base URL" },
  { key: "N8N_API_KEY", label: "n8n API key (X-N8N-API-KEY)" },
  { key: "N8N_AUTO_LIKE_WORKFLOW_ID", label: "n8n Auto Like/Comment template workflow ID" },
  { key: "N8N_HITLIST_WORKFLOW_ID", label: "n8n Hitlist template workflow ID" },
];

const optional = [
  { key: "AIRTABLE_TEMPLATE_AUTO_LIKE_TABLE_ID", label: "Airtable template table ID (Auto Like) - optional" },
  { key: "AIRTABLE_TEMPLATE_HITLIST_TABLE_ID", label: "Airtable template table ID (Hitlist) - optional" },
];

function getEnv(key) {
  const raw = process.env[key];
  if (raw == null) return "";
  const s = String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function checkVars() {
  const missing = [];
  const present = [];
  for (const { key, label } of required) {
    const value = getEnv(key);
    const set = value.length > 0 && value !== "your-base-id";
    if (set) {
      present.push({ key, label, masked: key.includes("KEY") || key.includes("TOKEN") ? "***" : value.slice(0, 20) + (value.length > 20 ? "…" : "") });
    } else {
      missing.push({ key, label });
    }
  }
  return { missing, present };
}

async function liveChecks(debug = false) {
  const baseId = getEnv("AIRTABLE_BASE_ID");
  const airtableKey = getEnv("AIRTABLE_API_KEY");
  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const n8nApiUrl = getEnv("N8N_API_URL").replace(/\/$/, "");
  const n8nApiKey = getEnv("N8N_API_KEY");
  const autoLikeId = getEnv("N8N_AUTO_LIKE_WORKFLOW_ID");
  const hitlistId = getEnv("N8N_HITLIST_WORKFLOW_ID");

  const results = [];

  // Supabase: GET rest/v1/ (headers only to check auth)
  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: "HEAD",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      results.push({
        name: "Supabase",
        ok: res.status === 200 || res.status === 404,
        detail: res.status === 200 ? "OK" : `HTTP ${res.status}`,
      });
    } catch (e) {
      results.push({ name: "Supabase", ok: false, detail: e.message });
    }
  } else {
    results.push({ name: "Supabase", ok: false, detail: "Missing URL or key" });
  }

  // Airtable: first list bases the token can access, then try to get our base schema
  if (baseId && airtableKey) {
    let detail = "";
    try {
      // 1) List all bases – if 403 here, token may not have Metadata API access or no bases granted
      const listRes = await fetch("https://api.airtable.com/v0/meta/bases", {
        headers: { Authorization: `Bearer ${airtableKey}` },
      });
      if (!listRes.ok) {
        if (listRes.status === 403) {
          detail = "403 on list bases – token may not have Metadata API access, or base not in token's access list. Check: Airtable token has schema.bases:read and this exact base (ID in URL when you open the base) is added to the token.";
        } else {
          detail = `List bases: HTTP ${listRes.status}`;
        }
        results.push({ name: "Airtable base", ok: false, detail });
      } else {
        const listData = await listRes.json();
        const bases = listData.bases || [];
        const ourBase = bases.find((b) => b.id === baseId);
        if (!ourBase) {
          const ids = bases.slice(0, 5).map((b) => `${b.name || b.id} (${b.id})`).join(", ");
          detail = `Base ${baseId} not in token's list. Token can see: ${ids}${bases.length > 5 ? " …" : ""}. In Airtable, open your base and add the base whose URL contains this ID to the token's Access.`;
          results.push({ name: "Airtable base", ok: false, detail });
        } else {
          // 2) Get schema for our base
          const schemaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}`, {
            headers: { Authorization: `Bearer ${airtableKey}` },
          });
          if (schemaRes.ok) {
            const schemaData = await schemaRes.json();
            detail = `OK (${(schemaData.tables || []).length} tables)`;
            results.push({ name: "Airtable base", ok: true, detail });
          } else {
            const baseListHint = bases.map((b) => b.id).includes(baseId)
              ? ` Base ${baseId} is in token's list (${ourBase.name || "unnamed"}) but schema returned ${schemaRes.status}. Try: remove and re-add this base to the token's Access; ensure scopes include schema.bases:read and schema.bases:write.`
              : "";
            detail = schemaRes.status === 403
              ? `403 on base schema.${baseListHint}`.trim()
              : `Schema: HTTP ${schemaRes.status}`;
            results.push({ name: "Airtable base", ok: false, detail });
          }
        }
      }
    } catch (e) {
      results.push({ name: "Airtable base", ok: false, detail: e.message });
    }
  } else {
    results.push({ name: "Airtable base", ok: false, detail: "Missing base ID or API key" });
  }

  // n8n: GET workflows/{id} for both template IDs
  if (n8nApiUrl && n8nApiKey) {
    for (const [label, id] of [
      ["n8n Auto Like workflow", autoLikeId],
      ["n8n Hitlist workflow", hitlistId],
    ]) {
      if (!id) {
        results.push({ name: label, ok: false, detail: "Missing workflow ID" });
        continue;
      }
      try {
        const res = await fetch(`${n8nApiUrl}/api/v1/workflows/${id}`, {
          headers: { "X-N8N-API-KEY": n8nApiKey },
        });
        const ok = res.ok;
        let detail = `HTTP ${res.status}`;
        if (ok) detail = "OK";
        else if (res.status === 401) detail = "Invalid API key";
        else if (res.status === 404) detail = "Workflow not found";
        results.push({ name: label, ok, detail });
      } catch (e) {
        results.push({ name: label, ok: false, detail: e.message });
      }
    }
  } else {
    results.push({ name: "n8n Auto Like workflow", ok: false, detail: "Missing N8N_API_URL or N8N_API_KEY" });
    results.push({ name: "n8n Hitlist workflow", ok: false, detail: "Missing N8N_API_URL or N8N_API_KEY" });
  }

  return results;
}

async function main() {
  const live = process.argv.includes("--live");
  const debug = process.argv.includes("--debug");

  loadEnv();

  console.log("Campaign Manager – env check\n");

  const { missing, present } = checkVars();

  console.log("Required variables:");
  for (const { label, masked } of present) {
    console.log("  ✓", label, masked ? `(${masked})` : "");
  }
  for (const { key, label } of missing) {
    console.log("  ✗", label, `(${key})`);
  }

  console.log("\nOptional (for schema clone):");
  for (const { key, label } of optional) {
    const value = getEnv(key);
    console.log(value ? `  ✓ ${label}` : `  – ${label} (not set)`);
  }

  if (missing.length > 0) {
    console.log("\n❌ Missing required variables. Add them to .env and run again.");
    process.exit(1);
  }

  console.log("\n✅ All required variables are set.");

  if (live) {
    console.log("\nLive checks (Supabase, Airtable, n8n):");
    const results = await liveChecks(debug);
    let allOk = true;
    for (const { name, ok, detail } of results) {
      console.log(ok ? "  ✓" : "  ✗", name + ":", detail);
      if (!ok) allOk = false;
    }
    if (debug) {
      const baseId = getEnv("AIRTABLE_BASE_ID");
      const airtableKey = getEnv("AIRTABLE_API_KEY");
      if (baseId && airtableKey) {
        try {
          const listRes = await fetch("https://api.airtable.com/v0/meta/bases", {
            headers: { Authorization: `Bearer ${airtableKey}` },
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const bases = listData.bases || [];
            console.log("\n  [debug] Bases this token can access:");
            bases.forEach((b) => {
              const match = b.id === baseId ? "  <-- AIRTABLE_BASE_ID in .env" : "";
              console.log(`    ${b.id}  ${(b.name || "(no name)")}${match}`);
            });
          }
        } catch (e) {
          console.log("  [debug] Could not list bases:", e.message);
        }
      }
    }
    if (!allOk) {
      const airtableOnly403 = results.filter((r) => !r.ok).length === 1
        && results.find((r) => r.name === "Airtable base" && r.detail.includes("403"));
      if (airtableOnly403) {
        console.log("\n⚠️  Airtable base schema returned 403 (see docs/CAMPAIGN-MANAGER-AIRTABLE-ENV.md).");
        console.log("    You can still proceed: table creation uses POST + built-in schema, no schema read needed.");
        console.log("✅ Proceeding is OK – other checks passed.");
      } else {
        console.log("\n⚠️  Some live checks failed. Fix credentials or network and run with --live again.");
        process.exit(1);
      }
    } else {
      console.log("\n✅ All live checks passed.");
    }
  } else {
    console.log("\nRun with --live to ping Supabase, Airtable, and n8n.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
