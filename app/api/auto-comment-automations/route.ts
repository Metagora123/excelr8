import { NextResponse } from "next/server"
import { getAutoCommentAutomations } from "@/lib/autoCommentAutomationQueries"
import type { SupabaseProject } from "@/lib/supabase"

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const project = parseProject(searchParams.get("project"))
  try {
    const automations = await getAutoCommentAutomations(project)
    return NextResponse.json(automations)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
