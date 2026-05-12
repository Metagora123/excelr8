import { NextResponse } from "next/server"
import { newsletterPromptQueries } from "@/lib/newsletterPromptQueries"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const items = await newsletterPromptQueries.list()
    return NextResponse.json({ ok: true, items })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      name?: string
      htmlPrompt?: string | null
      imagePrompt?: string | null
    } | null
    const name = body?.name?.trim()
    if (!name) {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 })
    }
    const item = await newsletterPromptQueries.create({
      name,
      htmlPrompt: body?.htmlPrompt ?? null,
      imagePrompt: body?.imagePrompt ?? null,
    })
    return NextResponse.json({ ok: true, item })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
