import { NextResponse } from "next/server"
import { createClient, type SupabaseProject } from "@/lib/supabase"
import { runSingleRowAirtableTrigger } from "@/lib/campaignAutomationQueries"

/**
 * GET /api/airtable/trigger?campaign_id=…&record_id=…&token=…
 *
 * Endpoint hit by the in-app Airtable button. Validates a per-campaign UUID
 * token (stored on `in_app_campaign_automations.airtable_button_token` and
 * mirrored on every Hitlist row's `Button_Token` field), then dispatches the
 * correct lifecycle action for the current row state:
 *
 *   fresh                                       → invite pass (single row)
 *   invited                                     → acceptance pass (single row)
 *   to_be_messaged / message_1_sent / _2_sent   → messaging pass (single row)
 *   messaged / invite_failed / messaging_failed → no-op, just a confirmation page
 *
 * Returns a small HTML page so the click opens a readable tab. JSON callers
 * can pass `?accept=json` for a machine-readable response.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const SUPPORTED_PROJECTS: SupabaseProject[] = ["sales2k25", "prod2k26"]

type Resolved = {
  project: SupabaseProject
  automationId: string
  campaignName: string | null
}

/**
 * The Airtable button doesn't know which Supabase project the campaign lives
 * in, so we try each project in turn until we find a matching automation with
 * the correct token. This stays O(2) and is fine.
 */
async function findAutomationByToken(
  campaignId: string,
  token: string
): Promise<Resolved | null> {
  for (const project of SUPPORTED_PROJECTS) {
    const supabase = createClient(project)
    const { data: aut } = await supabase
      .from("in_app_campaign_automations")
      .select("id, airtable_button_token, campaign_id")
      .eq("campaign_id", campaignId)
      .maybeSingle()
    if (aut?.airtable_button_token && String(aut.airtable_button_token) === token) {
      const { data: camp } = await supabase
        .from("campaigns")
        .select("name")
        .eq("id", campaignId)
        .maybeSingle()
      return {
        project,
        automationId: String(aut.id),
        campaignName: (camp?.name as string | undefined) ?? null,
      }
    }
  }
  return null
}

function htmlPage(opts: {
  status: "ok" | "error"
  title: string
  detail: string
  campaignName?: string | null
  recordId?: string | null
  dashboardHref?: string | null
}): string {
  const accent = opts.status === "ok" ? "#16a34a" : "#dc2626"
  const safe = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safe(opts.title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      margin: 0; padding: 2.5rem 1.5rem; background: #f8fafc; color: #0f172a; display: flex; justify-content: center;
    }
    .card {
      max-width: 520px; width: 100%; background: white; border-radius: 16px; padding: 2rem;
      border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 6px 24px rgba(0,0,0,0.04);
    }
    h1 { margin-top: 0; font-size: 1.25rem; color: ${accent}; }
    p  { line-height: 1.55; color: #334155; }
    .meta { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; color: #475569; }
    a.btn {
      display: inline-block; margin-top: 1.25rem; padding: 0.55rem 1rem;
      border-radius: 8px; background: #0f172a; color: white; text-decoration: none; font-weight: 500;
    }
    a.btn:hover { background: #1e293b; }
    @media (prefers-color-scheme: dark) {
      body { background: #0f172a; color: #e2e8f0; }
      .card { background: #1e293b; border-color: rgba(255,255,255,0.06); }
      p, .meta { color: #cbd5e1; }
      a.btn { background: #e2e8f0; color: #0f172a; }
      a.btn:hover { background: #f1f5f9; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safe(opts.title)}</h1>
    <p>${safe(opts.detail)}</p>
    ${
      opts.campaignName
        ? `<p class="meta">Campaign: ${safe(opts.campaignName)}</p>`
        : ""
    }
    ${
      opts.recordId
        ? `<p class="meta">Airtable record: ${safe(opts.recordId)}</p>`
        : ""
    }
    ${
      opts.dashboardHref
        ? `<a class="btn" href="${safe(opts.dashboardHref)}">View in dashboard</a>`
        : ""
    }
  </div>
</body>
</html>`
}

function decisionDetail(decision: string): string {
  switch (decision) {
    case "invite_sent":
      return "Invite sent through Unipile. Lead status moved to invited (or invite_failed if Unipile rejected it permanently)."
    case "acceptance_checked":
      return "Acceptance re-checked. If the lead has accepted, status moved to to_be_messaged."
    case "message_sent_or_scheduled":
      return "Message sent (or scheduled for later — see Tempo)."
    case "sequence_complete":
      return "Message_3 already delivered — sequence is complete. No action taken."
    case "invite_previously_failed":
      return "This row was previously marked invite_failed. Reset the Airtable status to fresh if you want to retry."
    case "messaging_previously_failed":
      return "This row was previously marked messaging_failed. Investigate the run logs before retrying."
    case "no_op":
      return "No action taken."
    case "error":
      return "Something went wrong. Check the dashboard's run logs for this campaign."
    default:
      return decision.startsWith("unknown_status=")
        ? `Row has an unexpected status (${decision.slice("unknown_status=".length)}). No action taken.`
        : "Trigger completed."
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const campaignId = (url.searchParams.get("campaign_id") || "").trim()
  const recordId = (url.searchParams.get("record_id") || "").trim()
  const token = (url.searchParams.get("token") || "").trim()
  const accept = (url.searchParams.get("accept") || req.headers.get("accept") || "").toLowerCase()
  const wantsJson = accept.includes("json")

  if (!campaignId || !recordId || !token) {
    const detail = "Missing campaign_id, record_id, or token query parameter."
    if (wantsJson) return NextResponse.json({ error: detail }, { status: 400 })
    return new Response(
      htmlPage({ status: "error", title: "Invalid trigger URL", detail }),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  }

  const resolved = await findAutomationByToken(campaignId, token)
  if (!resolved) {
    const detail =
      "Token does not match this campaign. The campaign's Button_Token field may have drifted from the dashboard — try regenerating the campaign or contact the admin."
    if (wantsJson) return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    return new Response(
      htmlPage({ status: "error", title: "Unauthorized", detail }),
      { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  }

  try {
    const result = await runSingleRowAirtableTrigger(
      resolved.project,
      resolved.automationId,
      recordId
    )
    const title =
      result.status === "error" ? "Trigger failed" : "Trigger completed"
    const detail = decisionDetail(result.decision)
    if (wantsJson) {
      return NextResponse.json({
        ok: result.status !== "error",
        decision: result.decision,
        summary: {
          messages_sent: result.summary.messages_sent_count,
          messaging_failed: result.summary.messaging_failed_count,
          retry_pending: result.summary.retry_pending_count,
          legacy_migrated: result.summary.legacy_migrated_count,
          leads: result.summary.leads.length,
        },
      })
    }
    return new Response(
      htmlPage({
        status: result.status === "error" ? "error" : "ok",
        title,
        detail,
        campaignName: resolved.campaignName,
        recordId,
        dashboardHref: `/campaign-status?campaign=${encodeURIComponent(campaignId)}`,
      }),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Unknown error"
    if (wantsJson) return NextResponse.json({ error: detail }, { status: 500 })
    return new Response(
      htmlPage({
        status: "error",
        title: "Trigger failed",
        detail,
        campaignName: resolved.campaignName,
        recordId,
      }),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  }
}
