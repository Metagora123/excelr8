import { NextResponse } from "next/server"
import { getKpiTotals, getAllCampaigns } from "@/lib/campaignQueries"
import { getCampaignAutomations } from "@/lib/campaignAutomationQueries"
import { createClient, type SupabaseProject } from "@/lib/supabase"

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

/**
 * Snapshot of CURRENT lead state per campaign, read from
 * `lead_campaigns.message_status`. `run_logs` counts events (lead X went
 * through accepted → message_1_sent → messaged), but the dashboard wants
 * "how many leads are in this state RIGHT NOW", which only lead_campaigns
 * answers cleanly.
 */
async function getMessageStatusCountsByCampaign(
  project: SupabaseProject
): Promise<Map<string, { to_be_messaged: number; messaged: number; messages_in_flight: number }>> {
  const out = new Map<string, { to_be_messaged: number; messaged: number; messages_in_flight: number }>()
  try {
    const supabase = createClient(project)
    const { data, error } = await supabase
      .from("lead_campaigns")
      .select("campaign_id, message_status")
    if (error || !Array.isArray(data)) return out
    for (const row of data as Array<{ campaign_id?: string; message_status?: string | null }>) {
      const id = row.campaign_id
      if (!id) continue
      const status = (row.message_status ?? "").trim()
      const bucket =
        out.get(id) ?? { to_be_messaged: 0, messaged: 0, messages_in_flight: 0 }
      if (status === "to_be_messaged") bucket.to_be_messaged += 1
      else if (status === "messaged") bucket.messaged += 1
      else if (status === "message_1_sent" || status === "message_2_sent") {
        bucket.messages_in_flight += 1
      }
      out.set(id, bucket)
    }
  } catch {
    // best-effort; KPI tile just renders 0
  }
  return out
}

/**
 * Count `message_*_sent` and `messaged` events from run_logs. Used for the
 * cumulative "messages sent" counter (an event count, not a current state).
 */
function countMessageEvents(runLogs: unknown): number {
  if (!Array.isArray(runLogs)) return 0
  let n = 0
  for (const run of runLogs as Array<{ leads?: Array<{ step?: string }> }>) {
    if (!run?.leads) continue
    for (const lead of run.leads) {
      const step = lead?.step ?? ""
      if (step === "message_1_sent" || step === "message_2_sent" || step === "message_3_sent" || step === "messaged") {
        n += 1
      }
    }
  }
  return n
}

/**
 * Buckets derived from `in_app_campaign_automations.run_logs[].leads[].step`.
 * In-app automation is the single source of truth for invites going forward.
 *
 *  - invited                → invites_sent
 *  - invite_failed          → send_failed       (Unipile said no: already invited / already connected / quota / etc.)
 *  - profile_not_found,
 *    unipile_profile_error  → profile_unreachable (private / restricted / 404 / non-transient HTTP error)
 *  - skip                   → skipped_bad_input  (no LinkedIn URL / invalid URL)
 *  - retry_pending          → retry_pending      (transient: 429, 5xx, network — will retry next run)
 */
export type CampaignKpiRow = {
  id: string
  name: string | null
  status: string | null
  messages_sent: number | null
  invites_sent: number
  replies_received: number | null
  comments_made: number | null
  likes_reactions: number | null
  send_failed: number
  profile_unreachable: number
  skipped_bad_input: number
  retry_pending: number
  // Block 4 additions
  to_be_messaged: number
  messaged: number
}

type RunLogLead = {
  step?: string
  decision?: string
  transient?: boolean
}
type RunLog = {
  leads?: RunLogLead[]
}

function bucketFromRunLogs(runLogs: unknown): {
  send_failed: number
  profile_unreachable: number
  skipped_bad_input: number
  retry_pending: number
} {
  const out = { send_failed: 0, profile_unreachable: 0, skipped_bad_input: 0, retry_pending: 0 }
  if (!Array.isArray(runLogs)) return out
  for (const run of runLogs as RunLog[]) {
    if (!run || !Array.isArray(run.leads)) continue
    for (const lead of run.leads) {
      const step = lead?.step
      if (!step) continue
      if (step === "retry_pending" || lead?.transient === true) {
        out.retry_pending += 1
      } else if (step === "invite_failed") {
        out.send_failed += 1
      } else if (step === "profile_not_found" || step === "unipile_profile_error") {
        out.profile_unreachable += 1
      } else if (step === "skip") {
        out.skipped_bad_input += 1
      }
    }
  }
  return out
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const [totalsBase, campaigns, automations, statusCountsByCampaign] = await Promise.all([
      getKpiTotals(project),
      getAllCampaigns(project),
      getCampaignAutomations(project),
      getMessageStatusCountsByCampaign(project),
    ])

    type AutoAgg = {
      invites_sent: number
      send_failed: number
      profile_unreachable: number
      skipped_bad_input: number
      retry_pending: number
      messages_sent_events: number
    }
    const byCampaign = new Map<string, AutoAgg>()
    let totalInvites = 0
    let totalSendFailed = 0
    let totalProfileUnreachable = 0
    let totalSkippedBadInput = 0
    let totalRetryPending = 0
    let totalMessagesSentEvents = 0

    for (const a of automations) {
      const buckets = bucketFromRunLogs(a.run_logs)
      const messagesEvt = countMessageEvents(a.run_logs)
      const cur =
        byCampaign.get(a.campaign_id) ?? {
          invites_sent: 0,
          send_failed: 0,
          profile_unreachable: 0,
          skipped_bad_input: 0,
          retry_pending: 0,
          messages_sent_events: 0,
        }
      cur.invites_sent += a.total_invites_sent ?? 0
      cur.send_failed += buckets.send_failed
      cur.profile_unreachable += buckets.profile_unreachable
      cur.skipped_bad_input += buckets.skipped_bad_input
      cur.retry_pending += buckets.retry_pending
      cur.messages_sent_events += messagesEvt
      byCampaign.set(a.campaign_id, cur)

      totalInvites += a.total_invites_sent ?? 0
      totalSendFailed += buckets.send_failed
      totalProfileUnreachable += buckets.profile_unreachable
      totalSkippedBadInput += buckets.skipped_bad_input
      totalRetryPending += buckets.retry_pending
      totalMessagesSentEvents += messagesEvt
    }

    let totalToBeMessaged = 0
    let totalMessaged = 0
    for (const counts of statusCountsByCampaign.values()) {
      totalToBeMessaged += counts.to_be_messaged
      totalMessaged += counts.messaged
    }

    // For total "messages sent", prefer the event count from run_logs (it's
    // the in-app authority). Fall back to the legacy `campaigns.messages_sent`
    // mirror so we don't show 0 on dashboards that haven't run the new pass.
    const messagesSentTotal = totalMessagesSentEvents || totalsBase.messages_sent

    const totals = {
      campaigns: totalsBase.campaigns,
      messages_sent: messagesSentTotal,
      comments_made: totalsBase.comments_made,
      likes_reactions: totalsBase.likes_reactions,
      // Source of truth for invites is in_app_campaign_automations only.
      invites_sent: totalInvites,
      send_failed: totalSendFailed,
      profile_unreachable: totalProfileUnreachable,
      skipped_bad_input: totalSkippedBadInput,
      retry_pending: totalRetryPending,
      to_be_messaged: totalToBeMessaged,
      messaged: totalMessaged,
    }

    const campaignsMerged: CampaignKpiRow[] = campaigns.slice(0, 12).map((c) => {
      const auto =
        byCampaign.get(c.id) ?? {
          invites_sent: 0,
          send_failed: 0,
          profile_unreachable: 0,
          skipped_bad_input: 0,
          retry_pending: 0,
          messages_sent_events: 0,
        }
      const stateCounts =
        statusCountsByCampaign.get(c.id) ?? { to_be_messaged: 0, messaged: 0, messages_in_flight: 0 }
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        messages_sent: auto.messages_sent_events || c.messages_sent,
        replies_received: c.replies_received,
        comments_made: c.comments_made,
        likes_reactions: c.likes_reactions,
        invites_sent: auto.invites_sent,
        send_failed: auto.send_failed,
        profile_unreachable: auto.profile_unreachable,
        skipped_bad_input: auto.skipped_bad_input,
        retry_pending: auto.retry_pending,
        to_be_messaged: stateCounts.to_be_messaged,
        messaged: stateCounts.messaged,
      }
    })

    return NextResponse.json({ totals, campaigns: campaignsMerged })
  } catch (err) {
    console.error("KPI API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load KPI data" },
      { status: 500 }
    )
  }
}
