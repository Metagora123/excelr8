import { NextResponse } from "next/server"
import { listR2Keys, filterMarkdownKeys, getR2ObjectBody, getR2ObjectHead } from "@/lib/r2"

type TitleSource = "html-title" | "h1" | "md-h1" | "filename"

type NewsletterFileItem = {
  key: string
  used: boolean
  displayTitle: string
  titleSource: TitleSource
}

function parseUsedKeysFromRunDoc(markdown: string): Set<string> {
  const used = new Set<string>()
  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s+`([^`]+)`\s*$/)
    if (m?.[1]) used.add(m[1].trim())
  }
  return used
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10)
      return Number.isFinite(code) ? String.fromCharCode(code) : _
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
      const code = parseInt(n, 16)
      return Number.isFinite(code) ? String.fromCharCode(code) : _
    })
}

function clean(s: string): string {
  return decodeHtmlEntities(s)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
}

function filenameToTitle(key: string): string {
  const base = key.split("/").pop() ?? key
  const noExt = base.replace(/\.(md|md\.temp|html|html\.temp)$/i, "")
  const cleaned = noExt.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
  if (!cleaned) return base
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function extractTitleFromContent(
  key: string,
  content: string
): { title: string; source: TitleSource } {
  const isHtml = /\.html(\.temp)?$/i.test(key)
  const isMd = /\.md(\.temp)?$/i.test(key)

  if (isHtml || /<\s*html|<\s*head|<\s*body|<\s*title|<\s*h1/i.test(content)) {
    const titleMatch = content.match(/<\s*title[^>]*>([\s\S]*?)<\s*\/\s*title\s*>/i)
    if (titleMatch?.[1]) {
      const t = clean(titleMatch[1].replace(/<[^>]+>/g, ""))
      if (t) return { title: t, source: "html-title" }
    }
    const h1Match = content.match(/<\s*h1[^>]*>([\s\S]*?)<\s*\/\s*h1\s*>/i)
    if (h1Match?.[1]) {
      const t = clean(h1Match[1].replace(/<[^>]+>/g, ""))
      if (t) return { title: t, source: "h1" }
    }
  }

  if (isMd || /^\s{0,3}#\s+\S/m.test(content)) {
    const mdH1 = content.match(/^\s{0,3}#\s+(.+?)\s*$/m)
    if (mdH1?.[1]) {
      const t = clean(mdH1[1].replace(/[*_`]+/g, ""))
      if (t) return { title: t, source: "md-h1" }
    }
  }

  return { title: filenameToTitle(key), source: "filename" }
}

async function buildItem(key: string, used: boolean): Promise<NewsletterFileItem> {
  try {
    const head = await getR2ObjectHead(key, 16384)
    const { title, source } = extractTitleFromContent(key, head)
    return { key, used, displayTitle: title, titleSource: source }
  } catch {
    return {
      key,
      used,
      displayTitle: filenameToTitle(key),
      titleSource: "filename",
    }
  }
}

/** GET: query ?date=YYYY-MM-DD. Returns list of source file keys for that date from R2 with extracted titles. */
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
    const items: NewsletterFileItem[] = await Promise.all(
      sourceKeys.map((key) => buildItem(key, usedKeys.has(key)))
    )
    return NextResponse.json(items)
  } catch (err) {
    console.error("Newsletter files API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load files" },
      { status: 500 }
    )
  }
}
