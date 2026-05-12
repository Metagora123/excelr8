import { NextResponse } from "next/server"
import {
  deleteCampaignAutomation,
  updateCampaignAutomationSchedule,
  runCampaignAutomation,
  runCampaignMessagingNow,
  setMessagingRunner,
  setMessagingQuota,
} from "@/lib/campaignAutomationQueries"
import type { SupabaseProject } from "@/lib/supabase"

// Campaign automations: two DBs (sales2k25, prod2k26). Same schema; data per project.
function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

// Messaging "Run now" can hit hundreds of leads × Unipile latency, so bump
// the runtime budget. Vercel Pro ceiling is 300s.
export const maxDuration = 300

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id?.trim()) {
    return NextResponse.json({ error: "Automation id required" }, { status: 400 })
  }
  const url = new URL(req.url)
  const project = parseProject(url.searchParams.get("project"))
  let body: {
    schedule_cron?: string
    messaging_runner?: "off" | "in_app"
    messaging_quota_daily?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  try {
    const trimmedId = id.trim()
    if (typeof body.schedule_cron === "string" && body.schedule_cron.trim()) {
      await updateCampaignAutomationSchedule(project, trimmedId, body.schedule_cron.trim())
    }
    if (body.messaging_runner === "off" || body.messaging_runner === "in_app") {
      await setMessagingRunner(project, trimmedId, body.messaging_runner)
    }
    if (typeof body.messaging_quota_daily === "number") {
      await setMessagingQuota(project, trimmedId, body.messaging_quota_daily)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    )
  }
}

/**
 * POST handlers:
 *   ?action=run-messaging  → streams progress while sending due DMs
 *   (default)              → run the full automation (invite + acceptance + messaging)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id?.trim()) {
    return NextResponse.json({ error: "Automation id required" }, { status: 400 })
  }
  const url = new URL(req.url)
  const project = parseProject(url.searchParams.get("project"))
  const action = url.searchParams.get("action")
  const trimmedId = id.trim()

  if (action === "run-messaging") {
    // NDJSON stream: one JSON object per line.
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder()
        const emit = (obj: Record<string, unknown>) =>
          controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"))
        try {
          emit({ phase: "started", at: new Date().toISOString() })
          const result = await runCampaignMessagingNow(project, trimmedId, (info) => {
            emit({
              phase: "progress",
              processed: info.processed,
              total: info.total,
              current: info.current,
            })
          })
          emit({
            phase: "completed",
            last_run_at: result.last_run_at,
            last_run_status: result.last_run_status,
            messages_sent: result.summary.messages_sent_count,
            messaging_failed: result.summary.messaging_failed_count,
            retry_pending: result.summary.retry_pending_count,
            leads: result.summary.leads.length,
          })
        } catch (e) {
          emit({
            phase: "error",
            error: e instanceof Error ? e.message : String(e),
          })
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
      },
    })
  }

  try {
    const result = await runCampaignAutomation(project, trimmedId)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Run failed" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id?.trim()) {
    return NextResponse.json({ error: "Automation id required" }, { status: 400 })
  }
  const url = new URL(_req.url)
  const project = parseProject(url.searchParams.get("project"))

  try {
    await deleteCampaignAutomation(project, id.trim())
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 500 }
    )
  }
}
