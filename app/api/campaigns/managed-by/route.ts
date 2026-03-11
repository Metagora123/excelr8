import { NextResponse } from "next/server"
import { getUnipileAccounts } from "@/lib/campaignQueries"

function parseProject(v: string | null): "sales2k25" | "prod2k26" {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const project = parseProject(searchParams.get("project"))
    const accounts = await getUnipileAccounts(project)
    return NextResponse.json(accounts)
  } catch (err) {
    console.error("Managed-by (unipile_accounts) API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load managed-by options" },
      { status: 500 }
    )
  }
}
