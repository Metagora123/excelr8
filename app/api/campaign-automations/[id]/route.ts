import { NextResponse } from "next/server"
import {
  deleteCampaignAutomation,
  updateCampaignAutomationSchedule,
  runCampaignAutomation,
} from "@/lib/campaignAutomationQueries"
import type { SupabaseProject } from "@/lib/supabase"

// Campaign automations: two DBs (sales2k25, prod2k26). Same schema; data per project.
function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

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
  let body: { schedule_cron?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const scheduleCron = body.schedule_cron?.trim()
  if (!scheduleCron) {
    return NextResponse.json({ error: "schedule_cron required" }, { status: 400 })
  }
  try {
    await updateCampaignAutomationSchedule(project, id.trim(), scheduleCron)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    )
  }
}

export async function POST(
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
    const result = await runCampaignAutomation(project, id.trim())
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
