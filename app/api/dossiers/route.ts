import { NextResponse } from "next/server"
import { getWithDossiers } from "@/lib/leadQueries"

export async function GET() {
  try {
    const leads = await getWithDossiers()
    return NextResponse.json(leads)
  } catch (err) {
    console.error("Dossiers API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load dossiers" },
      { status: 500 }
    )
  }
}
