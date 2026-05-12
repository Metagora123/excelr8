import { NextResponse } from "next/server"
import { newsletterPromptQueries } from "@/lib/newsletterPromptQueries"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id?.trim()) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 })
    }
    const body = (await req.json().catch(() => null)) as {
      name?: string
      htmlPrompt?: string | null
      imagePrompt?: string | null
    } | null
    const item = await newsletterPromptQueries.update(id, {
      name: body?.name,
      htmlPrompt: body?.htmlPrompt,
      imagePrompt: body?.imagePrompt,
    })
    return NextResponse.json({ ok: true, item })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id?.trim()) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 })
    }
    await newsletterPromptQueries.remove(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
