import { NextResponse } from "next/server"
import { listR2DatePrefixes } from "@/lib/r2"

/** Returns date folder names (YYYY-MM-DD) for the newsletter dropdown.
 *  Uses R2 common prefixes when configured; otherwise last 30 days. */
export async function GET() {
  try {
    try {
      const folders = await listR2DatePrefixes()
      if (folders.length > 0) return NextResponse.json(folders)
    } catch {
      // R2 not configured or empty; fallback below
    }
    const count = 30
    const folders: string[] = []
    const today = new Date()
    for (let i = 0; i < count; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      folders.push(d.toISOString().slice(0, 10))
    }
    return NextResponse.json(folders)
  } catch (err) {
    console.error("Date folders API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load date folders" },
      { status: 500 }
    )
  }
}
