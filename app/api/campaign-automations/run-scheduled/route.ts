import { NextResponse } from "next/server"
import { getCampaignAutomations, runCampaignAutomation } from "@/lib/campaignAutomationQueries"
import { getCronSecret } from "@/lib/env"
import type { SupabaseProject } from "@/lib/supabase"

/**
 * Returns true if an automation with this schedule and last_run_at is due to run now (UTC).
 * Supports: "0 6 * * *" (daily 6:00), "interval:24" (after 1 day), "interval:72" (after 3 days), "interval:168" (after 1 week).
 * Legacy: "0 */N * * *" (every N hours) still works.
 */
function isDue(scheduleCron: string, lastRunAt: string | null): boolean {
  const now = new Date()
  const nowMs = now.getTime()
  if (!lastRunAt) return true

  const raw = scheduleCron.trim()

  // "interval:N" – run every N hours (e.g. 24 = 1 day, 72 = 3 days, 168 = 1 week)
  if (raw.startsWith("interval:")) {
    const n = parseInt(raw.slice(9), 10)
    if (!Number.isFinite(n) || n < 1) return false
    const last = new Date(lastRunAt)
    return nowMs - last.getTime() >= n * 60 * 60 * 1000
  }

  const parts = raw.split(/\s+/)
  if (parts.length < 5) return false

  const last = new Date(lastRunAt)
  const lastMs = last.getTime()

  // "0 6 * * *" – daily at 6:00 UTC
  if (parts[0] === "0" && parts[1] === "6" && parts[2] === "*" && parts[3] === "*" && parts[4] === "*") {
    const today6 = new Date(now)
    today6.setUTCHours(6, 0, 0, 0)
    if (nowMs < today6.getTime()) return false
    return lastMs < today6.getTime()
  }

  // "0 */N * * *" – every N hours (legacy)
  if (parts[1].startsWith("*/")) {
    const n = parseInt(parts[1].slice(2), 10)
    if (!Number.isFinite(n) || n < 1) return false
    return nowMs - lastMs >= n * 60 * 60 * 1000
  }

  return false
}

const PROJECTS: SupabaseProject[] = ["sales2k25", "prod2k26"]

/**
 * GET (or POST) /api/campaign-automations/run-scheduled
 * Called by Vercel Cron every 15 minutes. Runs automations that are due per their schedule_cron.
 * Secured by CRON_SECRET (Bearer token in Authorization header).
 */
export async function GET(req: Request) {
  const secret = getCronSecret()
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not set" },
      { status: 500 }
    )
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: { project: string; automationId: string; status: string; error?: string }[] = []

  for (const project of PROJECTS) {
    let automations: Awaited<ReturnType<typeof getCampaignAutomations>>
    try {
      automations = await getCampaignAutomations(project)
    } catch (e) {
      results.push({
        project,
        automationId: "-",
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      })
      continue
    }

    const active = automations.filter((a) => a.is_active)
    for (const a of active) {
      if (!isDue(a.schedule_cron, a.last_run_at ?? null)) continue
      try {
        await runCampaignAutomation(project, a.id)
        results.push({ project, automationId: a.id, status: "ok" })
      } catch (e) {
        results.push({
          project,
          automationId: a.id,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  return NextResponse.json({ ran: results.length, results })
}

export async function POST(req: Request) {
  return GET(req)
}
