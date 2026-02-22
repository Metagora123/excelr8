import { NextResponse } from "next/server"
import { getN8nWebhookUrl, getN8nSupabaseTestEndpoint, getN8nSupabaseProdEndpoint } from "@/lib/env-n8n"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("data") as File | null
    const endpoint = formData.get("endpoint") as string | null // "test" | "prod"
    if (!file) {
      return NextResponse.json({ error: "No file provided (field: data)" }, { status: 400 })
    }
    const baseUrl = getN8nWebhookUrl()
    const path = endpoint === "prod" ? getN8nSupabaseProdEndpoint() : getN8nSupabaseTestEndpoint()
    const url = `${baseUrl.replace(/\/$/, "")}/${path}`
    if (!baseUrl) {
      return NextResponse.json({ error: "VITE_N8N_WEBHOOK_URL not set" }, { status: 500 })
    }
    const body = new FormData()
    body.append("data", file)
    const res = await fetch(url, { method: "POST", body })
    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json({ error: text || res.statusText, ok: false }, { status: 502 })
    }
    return NextResponse.json({ success: true, message: "Upload sent to n8n" })
  } catch (err) {
    console.error("Ingestion API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    )
  }
}
