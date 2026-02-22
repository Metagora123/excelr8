import { NextResponse } from "next/server"

/** Returns a list of date folder names (YYYY-MM-DD) for the newsletter dropdown.
 *  Default: last 30 days, newest first. Replace with R2 list when wired. */
export async function GET() {
  try {
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
