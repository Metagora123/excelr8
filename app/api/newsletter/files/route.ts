import { NextResponse } from "next/server"
import { listR2Keys, filterMarkdownKeys, getR2ObjectBody } from "@/lib/r2"

type NewsletterFileItem = {
  key: string
  used: boolean
}

function parseUsedKeysFromRunDoc(markdown: string): Set<string> {
  const used = new Set<string>()
  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s+`([^`]+)`\s*$/)
    if (m?.[1]) used.add(m[1].trim())
  }
  return used
}

/** GET: query ?date=YYYY-MM-DD. Returns list of source file keys for that date from R2. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date")?.trim()
    if (!date) {
      return NextResponse.json([])
    }
    const keys = await listR2Keys(date)
    const sourceKeys = filterMarkdownKeys(keys).filter(
      (k) => !k.endsWith("/newsletter.html") && !k.endsWith("/newsletter-run.md")
    )
    let usedKeys = new Set<string>()
    try {
      const runDoc = await getR2ObjectBody(`${date}/newsletter-run.md`)
      usedKeys = parseUsedKeysFromRunDoc(runDoc)
    } catch {
      // No run doc yet or read error; keep used=false.
    }
    const items: NewsletterFileItem[] = sourceKeys.map((key) => ({
      key,
      used: usedKeys.has(key),
    }))
    return NextResponse.json(items)
  } catch (err) {
    console.error("Newsletter files API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load files" },
      { status: 500 }
    )
  }
}
