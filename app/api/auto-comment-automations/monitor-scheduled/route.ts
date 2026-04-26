import { NextResponse } from "next/server"
import {
  getAutoCommentAutomations,
  runAutoCommentMonitoringAutomation,
} from "@/lib/autoCommentAutomationQueries"
import { getCronSecret } from "@/lib/env"
import type { SupabaseProject } from "@/lib/supabase"

const PROJECTS: SupabaseProject[] = ["sales2k25", "prod2k26"]

/**
 * GET/POST /api/auto-comment-automations/monitor-scheduled
 * Runs monitor flow for all active auto-comment automations.
 * Secured by CRON_SECRET bearer token.
 */
export async function GET(req: Request) {
  const secret = getCronSecret()
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: { project: string; automationId: string; status: string; error?: string }[] = []

  for (const project of PROJECTS) {
    let automations: Awaited<ReturnType<typeof getAutoCommentAutomations>>
    try {
      automations = await getAutoCommentAutomations(project)
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
      try {
        await runAutoCommentMonitoringAutomation(project, a.id)
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
