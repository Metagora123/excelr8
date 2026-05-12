import { NextResponse } from "next/server"
import { createClient, type SupabaseProject } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

type RawLead = {
  airtable_record_id?: string
  linkedin_url?: string
  step?: string
  decision?: string
  error?: string
  unipile_profile_status?: number
  unipile_profile_response?: string
  unipile_invite_status?: number
  unipile_invite_response?: string
  unipile_degree?: string
  transient?: boolean
  messages_generated?: boolean
  messages_error?: string
  message_1?: string
  message_2?: string
  message_3?: string
}

type RawRun = {
  run_date?: string
  started_at?: string
  finished_at?: string
  status?: string
  invited_count?: number
  to_be_messaged_count?: number
  rejected_count?: number
  retry_pending_count?: number
  leads?: RawLead[]
}

type RawAutomationRow = {
  id: string
  campaign_id: string
  airtable_base_id: string | null
  airtable_table_id: string | null
  total_invites_sent: number | null
  invites_sent_today: number | null
  total_to_be_messaged: number | null
  total_rejected: number | null
  last_run_at: string | null
  last_run_status: string | null
  run_logs: unknown
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    if (!campaignId?.trim()) {
      return NextResponse.json({ error: "campaign id is required" }, { status: 400 })
    }
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))

    const supabase = createClient(project)

    const [{ data: camp, error: campErr }, { data: automations, error: autoErr }] = await Promise.all([
      supabase
        .from("campaigns")
        .select(
          "id, name, status, messages_sent, invites_sent, comments_made, likes_reactions, created_at"
        )
        .eq("id", campaignId)
        .single(),
      supabase
        .from("in_app_campaign_automations")
        .select(
          "id, campaign_id, airtable_base_id, airtable_table_id, total_invites_sent, invites_sent_today, total_to_be_messaged, total_rejected, last_run_at, last_run_status, run_logs"
        )
        .eq("campaign_id", campaignId),
    ])

    if (campErr) {
      return NextResponse.json({ error: campErr.message }, { status: 404 })
    }
    if (autoErr) {
      return NextResponse.json({ error: autoErr.message }, { status: 500 })
    }

    const buckets = {
      invites_sent: 0,
      send_failed: 0,
      profile_unreachable: 0,
      skipped_bad_input: 0,
      retry_pending: 0,
    }

    type FlatLead = RawLead & {
      automation_id: string
      run_index: number
      run_date: string | null
      run_started_at: string | null
      run_status: string | null
    }
    const flat: FlatLead[] = []
    const automationsOut: Array<{
      id: string
      airtable_base_id: string | null
      airtable_table_id: string | null
      total_invites_sent: number
      total_to_be_messaged: number
      total_rejected: number
      last_run_at: string | null
      last_run_status: string | null
      runs: RawRun[]
    }> = []

    for (const a of (automations ?? []) as RawAutomationRow[]) {
      const runs = Array.isArray(a.run_logs) ? (a.run_logs as RawRun[]) : []
      automationsOut.push({
        id: a.id,
        airtable_base_id: a.airtable_base_id,
        airtable_table_id: a.airtable_table_id,
        total_invites_sent: a.total_invites_sent ?? 0,
        total_to_be_messaged: a.total_to_be_messaged ?? 0,
        total_rejected: a.total_rejected ?? 0,
        last_run_at: a.last_run_at,
        last_run_status: a.last_run_status,
        runs,
      })

      buckets.invites_sent += a.total_invites_sent ?? 0

      runs.forEach((run, runIdx) => {
        const leads = Array.isArray(run.leads) ? run.leads : []
        for (const lead of leads) {
          const step = lead?.step
          if (step === "retry_pending" || lead?.transient === true) {
            buckets.retry_pending += 1
          } else if (step === "invite_failed") {
            buckets.send_failed += 1
          } else if (step === "profile_not_found" || step === "unipile_profile_error") {
            buckets.profile_unreachable += 1
          } else if (step === "skip") {
            buckets.skipped_bad_input += 1
          }
          flat.push({
            ...lead,
            automation_id: a.id,
            run_index: runIdx,
            run_date: run.run_date ?? null,
            run_started_at: run.started_at ?? null,
            run_status: run.status ?? null,
          })
        }
      })
    }

    flat.sort((a, b) => {
      const ta = a.run_started_at ?? a.run_date ?? ""
      const tb = b.run_started_at ?? b.run_date ?? ""
      return tb.localeCompare(ta)
    })

    return NextResponse.json({
      campaign: camp,
      automations: automationsOut,
      buckets,
      leads: flat,
    })
  } catch (err) {
    console.error("KPI campaign run-logs error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load run logs" },
      { status: 500 }
    )
  }
}
