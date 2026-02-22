import { NextResponse } from "next/server"
import { getClients } from "@/lib/campaignQueries"

export async function GET() {
  try {
    const clients = await getClients()
    return NextResponse.json(clients)
  } catch (err) {
    console.error("Clients API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load clients" },
      { status: 500 }
    )
  }
}
