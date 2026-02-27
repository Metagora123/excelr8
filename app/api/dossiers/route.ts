import { NextResponse } from "next/server"
import { getWithDossiers } from "@/lib/leadQueries"

function parseProject(v: string | null): "sales2k25" | "prod2k26" {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const leads = await getWithDossiers(project)
    return NextResponse.json(leads)
  } catch (err) {
    console.error("Dossiers API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load dossiers" },
      { status: 500 }
    )
  }
}
