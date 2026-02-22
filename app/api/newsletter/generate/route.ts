import { NextResponse } from "next/server"
import { getN8nWebhookUrl, getN8nNewsletterTestEndpoint, getN8nNewsletterProdEndpoint } from "@/lib/env-n8n"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { endpoint = "test", tone, customTone, dateFolder } = body as {
      endpoint?: string
      tone?: string
      customTone?: string
      dateFolder?: string
    }
    const baseUrl = getN8nWebhookUrl()
    const path = endpoint === "prod" ? getN8nNewsletterProdEndpoint() : getN8nNewsletterTestEndpoint()
    const url = `${baseUrl.replace(/\/$/, "")}/${path}`
    if (!baseUrl) {
      return NextResponse.json({ error: "VITE_N8N_WEBHOOK_URL not set" }, { status: 500 })
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tone: customTone || tone || "professional",
        ...(dateFolder && { dateFolder }),
      }),
    })
    const text = await res.text()
    let data: unknown = text
    try {
      data = JSON.parse(text)
    } catch {
      // keep as text
    }
    if (!res.ok) {
      return NextResponse.json({ error: text || res.statusText, ok: false }, { status: 502 })
    }
    return NextResponse.json(typeof data === "object" && data !== null && "html" in (data as object) ? (data as { html: string }) : { html: text })
  } catch (err) {
    console.error("Newsletter API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate failed" },
      { status: 500 }
    )
  }
}
