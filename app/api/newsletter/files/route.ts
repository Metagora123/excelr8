import { NextResponse } from "next/server"
import { listR2Keys, filterMarkdownKeys } from "@/lib/r2"

/** GET: query ?date=YYYY-MM-DD. Returns list of file keys (markdown) for that date from R2. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date")?.trim()
    if (!date) {
      return NextResponse.json([])
    }
    const keys = await listR2Keys(date)
    const markdownKeys = filterMarkdownKeys(keys)
    return NextResponse.json(markdownKeys)
  } catch (err) {
    console.error("Newsletter files API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load files" },
      { status: 500 }
    )
  }
}
