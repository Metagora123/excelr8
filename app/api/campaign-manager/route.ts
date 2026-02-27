import { NextResponse } from "next/server"
import { getN8nWebhookUrl, getN8nCampaignTestEndpoint, getN8nCampaignProdEndpoint } from "@/lib/env-n8n"

function parseProject(v: string | null): "sales2k25" | "prod2k26" {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const campaignName = formData.get("campaignName") as string | null
    const clientId = formData.get("clientId") as string | null
    const category = formData.get("category") as string | null
    const managedBy = formData.get("managedBy") as string | null
    const endpoint = formData.get("endpoint") as string | null // "test" | "prod"
    const supabaseProject = parseProject(formData.get("supabaseProject") as string | null)
    if (!file) {
      return NextResponse.json({ error: "No CSV file provided" }, { status: 400 })
    }
    const baseUrl = getN8nWebhookUrl()
    const path = endpoint === "prod" ? getN8nCampaignProdEndpoint(supabaseProject) : getN8nCampaignTestEndpoint(supabaseProject)
    const url = `${baseUrl.replace(/\/$/, "")}/${path}`
    if (!baseUrl) {
      return NextResponse.json({ error: "VITE_N8N_WEBHOOK_URL not set" }, { status: 500 })
    }
    const body = new FormData()
    body.append("file", file)
    if (campaignName) body.append("campaignName", campaignName)
    if (clientId) body.append("clientId", clientId)
    if (category) body.append("category", category)
    if (managedBy) body.append("managedBy", managedBy)
    const res = await fetch(url, { method: "POST", body })
    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json({ error: text || res.statusText, ok: false }, { status: 502 })
    }
    return NextResponse.json({ success: true, message: "Campaign sent to n8n" })
  } catch (err) {
    console.error("Campaign Manager API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    )
  }
}
