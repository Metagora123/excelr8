import { NextResponse } from "next/server"
import { listR2Keys, getR2ObjectBody } from "@/lib/r2"

const NEWSLETTER_HTML_KEY = "newsletter.html"
const NEWSLETTER_RUN_KEY = "newsletter-run.md"

/** GET ?date=YYYY-MM-DD returns { hasNewsletter, hasRunDoc }.
 *  GET ?date=YYYY-MM-DD&file=newsletter.html | newsletter-run.md returns the file content for download. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date")?.trim()
    const file = searchParams.get("file")?.trim()

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Missing or invalid date (use YYYY-MM-DD)" },
        { status: 400 }
      )
    }

    const prefix = `${date}/`

    if (file === "newsletter.html" || file === "newsletter-run.md") {
      const key = `${prefix}${file}`
      try {
        const body = await getR2ObjectBody(key)
        const filename = file === "newsletter.html" ? `newsletter-${date}.html` : `newsletter-run-${date}.md`
        return new NextResponse(body, {
          headers: {
            "Content-Type": file === "newsletter.html" ? "text/html" : "text/markdown",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        })
      } catch {
        return new NextResponse(null, { status: 404 })
      }
    }

    const keys = await listR2Keys(prefix)
    const hasNewsletter = keys.some((k) => k === `${prefix}${NEWSLETTER_HTML_KEY}`)
    const hasRunDoc = keys.some((k) => k === `${prefix}${NEWSLETTER_RUN_KEY}`)
    return NextResponse.json({ hasNewsletter, hasRunDoc })
  } catch (err) {
    console.error("Newsletter archive API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    )
  }
}
