import { NextResponse } from "next/server"
import { runAutoCommentAutomation } from "@/lib/autoCommentAutomationQueries"
import type { SupabaseProject } from "@/lib/supabase"

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const project = parseProject(searchParams.get("project"))
  if (!id) {
    return NextResponse.json({ error: "Missing automation id" }, { status: 400 })
  }
  try {
    const result = await runAutoCommentAutomation(project, id)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
