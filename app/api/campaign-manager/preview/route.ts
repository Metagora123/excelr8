import { NextResponse } from "next/server"
import { parseCsvToNormalizedRows } from "@/lib/campaign-manager-inline"
import { createClient, type SupabaseProject } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

/**
 * Lookup the campaigns each preview lead is already part of, keyed by
 * `profile_url` (per user spec). We deliberately only match on profile_url:
 * matching on name produces too many false positives, and email is sparsely
 * populated in source CSVs.
 */
async function fetchExistingCampaignsByProfileUrl(
  project: SupabaseProject,
  profileUrls: string[]
): Promise<Map<string, Array<{ id: string; name: string | null }>>> {
  const result = new Map<string, Array<{ id: string; name: string | null }>>()
  if (profileUrls.length === 0) return result
  const supabase = createClient(project)

  // 1) Look up lead ids by profile_url.
  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, profile_url")
    .in("profile_url", profileUrls)
  if (leadsErr) throw new Error(`leads lookup: ${leadsErr.message}`)
  const leadList = (leads ?? []) as Array<{ id: string; profile_url: string | null }>
  if (leadList.length === 0) return result

  // 2) Pull every lead_campaigns row for those lead ids.
  const leadIds = leadList.map((l) => l.id)
  const { data: links, error: linksErr } = await supabase
    .from("lead_campaigns")
    .select("lead_id, campaign_id")
    .in("lead_id", leadIds)
  if (linksErr) throw new Error(`lead_campaigns lookup: ${linksErr.message}`)
  const linkList = (links ?? []) as Array<{ lead_id: string; campaign_id: string }>
  if (linkList.length === 0) return result

  // 3) Resolve campaign id → display name in a single query.
  // `campaigns.id` is the UUID; `lead_campaigns.campaign_id` is the FK to that
  // same column, so we match on `id` (NOT `campaign_id`).
  const campaignIds = Array.from(new Set(linkList.map((l) => l.campaign_id))).filter(Boolean)
  const { data: campaigns, error: campErr } = await supabase
    .from("campaigns")
    .select("id, name")
    .in("id", campaignIds)
  if (campErr) throw new Error(`campaigns lookup: ${campErr.message}`)
  const campaignNameById = new Map<string, string | null>()
  for (const c of (campaigns ?? []) as Array<{ id: string; name: string | null }>) {
    campaignNameById.set(c.id, c.name ?? null)
  }

  // 4) Build profile_url → [{ id, name }] map.
  const leadIdToProfileUrl = new Map<string, string>()
  for (const l of leadList) {
    if (l.profile_url) leadIdToProfileUrl.set(l.id, l.profile_url)
  }
  for (const link of linkList) {
    const profileUrl = leadIdToProfileUrl.get(link.lead_id)
    if (!profileUrl) continue
    const arr = result.get(profileUrl) ?? []
    if (!arr.some((c) => c.id === link.campaign_id)) {
      arr.push({ id: link.campaign_id, name: campaignNameById.get(link.campaign_id) ?? null })
    }
    result.set(profileUrl, arr)
  }
  return result
}

export async function POST(req: Request) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }
  const file = formData.get("file") as File | null
  const project = parseProject(formData.get("supabaseProject") as string | null)
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 })
  }
  try {
    const csvText = await file.text()
    const leads = parseCsvToNormalizedRows(csvText)

    // Duplicate detection is best-effort: a Supabase outage shouldn't block
    // the preview itself. If the lookup fails we return leads with empty
    // `existingCampaigns` and surface a `duplicateLookupError` for the UI.
    let dupesByUrl = new Map<string, Array<{ id: string; name: string | null }>>()
    let duplicateLookupError: string | undefined
    try {
      const urls = Array.from(
        new Set(
          leads
            .map((l) => (l.profile_url ?? "").trim())
            .filter((u): u is string => Boolean(u))
        )
      )
      dupesByUrl = await fetchExistingCampaignsByProfileUrl(project, urls)
    } catch (e) {
      duplicateLookupError = e instanceof Error ? e.message : String(e)
    }

    const enriched = leads.map((l) => {
      const url = (l.profile_url ?? "").trim()
      const existing = url ? dupesByUrl.get(url) ?? [] : []
      return { ...l, existingCampaigns: existing }
    })

    return NextResponse.json({
      leads: enriched,
      total: enriched.length,
      duplicateLookupError,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to parse CSV" },
      { status: 500 }
    )
  }
}
