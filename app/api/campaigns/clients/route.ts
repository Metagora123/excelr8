import { NextResponse } from "next/server"
import { getClients } from "@/lib/campaignQueries"

function parseProject(v: string | null): "sales2k25" | "prod2k26" {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const clients = await getClients(project)
    return NextResponse.json(clients)
  } catch (err) {
    console.error("Clients API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load clients" },
      { status: 500 }
    )
  }
}
