import { NextResponse } from "next/server"

/** GET: query ?date=YYYY-MM-DD. Returns list of file names/paths for that date folder.
 *  Replace with R2 list when wired. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date")?.trim()
    if (!date) {
      return NextResponse.json([])
    }
    // Mock: return placeholder filenames for the selected date. Replace with R2 list.
    const mockFiles = [
      `${date}-summary.md`,
      `${date}-highlights.json`,
      `posts-${date}.csv`,
    ]
    return NextResponse.json(mockFiles)
  } catch (err) {
    console.error("Newsletter files API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load files" },
      { status: 500 }
    )
  }
}
