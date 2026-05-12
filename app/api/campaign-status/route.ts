import { NextResponse } from "next/server"
import { createClient, type SupabaseProject } from "@/lib/supabase"

/**
 * Lead Campaign Status API.
 *
 * Two modes:
 *   GET /api/campaign-status?mode=by-lead&q=<name|url|email>&project=<...>
 *     → returns up to 20 matching leads, each with the full list of campaigns
 *       they appear in and the lifecycle timestamps for each one.
 *
 *   GET /api/campaign-status?mode=by-campaign&campaign_id=<uuid>&project=<...>
 *     → returns every lead in the campaign with their current `message_status`
 *       and lifecycle timestamps.
 */
export const dynamic = "force-dynamic"

function parseProject(v: string | null): SupabaseProject {
  return v === "prod2k26" ? "prod2k26" : "sales2k25"
}

type LeadCampaignEntry = {
  campaign_id: string
  campaign_name: string | null
  status: string | null
  message_status: string | null
  joined_at: string | null
  acceptance_detected_at: string | null
  message_1_sent_at: string | null
  message_2_sent_at: string | null
  message_3_sent_at: string | null
}

type LeadEntry = {
  id: string
  full_name: string | null
  profile_url: string | null
  email: string | null
  company_name: string | null
  title: string | null
  campaigns: LeadCampaignEntry[]
}

async function byLead(project: SupabaseProject, q: string): Promise<LeadEntry[]> {
  const supabase = createClient(project)
  const term = q.trim()
  if (!term) return []
  // Match name OR profile_url OR email — single OR clause, capped at 20 leads.
  // Postgres `ilike` patterns with the OR comma syntax handle this neatly.
  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, full_name, profile_url, email, company_name, title")
    .or(
      `full_name.ilike.%${term}%,profile_url.ilike.%${term}%,email.ilike.%${term}%`
    )
    .limit(20)
  if (leadsErr || !leads) return []
  if (leads.length === 0) return []

  const leadIds = (leads as Array<{ id: string }>).map((l) => l.id)
  const { data: lcs } = await supabase
    .from("lead_campaigns")
    .select(
      "lead_id, campaign_id, status, message_status, joined_at, acceptance_detected_at, message_1_sent_at, message_2_sent_at, message_3_sent_at"
    )
    .in("lead_id", leadIds)
  const lcRows = (lcs ?? []) as Array<
    LeadCampaignEntry & { lead_id: string }
  >
  const campaignIds = Array.from(new Set(lcRows.map((r) => r.campaign_id))).filter(Boolean)
  let campaignMap = new Map<string, string | null>()
  if (campaignIds.length > 0) {
    const { data: camps } = await supabase
      .from("campaigns")
      .select("id, name")
      .in("id", campaignIds)
    for (const c of (camps ?? []) as Array<{ id: string; name: string | null }>) {
      campaignMap.set(c.id, c.name)
    }
  }

  const byLeadId = new Map<string, LeadCampaignEntry[]>()
  for (const r of lcRows) {
    const entry: LeadCampaignEntry = {
      campaign_id: r.campaign_id,
      campaign_name: campaignMap.get(r.campaign_id) ?? null,
      status: r.status ?? null,
      message_status: r.message_status ?? null,
      joined_at: r.joined_at ?? null,
      acceptance_detected_at: r.acceptance_detected_at ?? null,
      message_1_sent_at: r.message_1_sent_at ?? null,
      message_2_sent_at: r.message_2_sent_at ?? null,
      message_3_sent_at: r.message_3_sent_at ?? null,
    }
    const bucket = byLeadId.get(r.lead_id) ?? []
    bucket.push(entry)
    byLeadId.set(r.lead_id, bucket)
  }

  return (leads as Array<{
    id: string
    full_name: string | null
    profile_url: string | null
    email: string | null
    company_name: string | null
    title: string | null
  }>).map((l) => ({
    id: l.id,
    full_name: l.full_name,
    profile_url: l.profile_url,
    email: l.email,
    company_name: l.company_name,
    title: l.title,
    campaigns: (byLeadId.get(l.id) ?? []).sort((a, b) =>
      (b.joined_at ?? "").localeCompare(a.joined_at ?? "")
    ),
  }))
}

type CampaignLeadRow = {
  lead_id: string
  full_name: string | null
  profile_url: string | null
  email: string | null
  company_name: string | null
  title: string | null
  status: string | null
  message_status: string | null
  joined_at: string | null
  acceptance_detected_at: string | null
  message_1_sent_at: string | null
  message_2_sent_at: string | null
  message_3_sent_at: string | null
}

async function byCampaign(
  project: SupabaseProject,
  campaignId: string
): Promise<{
  campaign: { id: string; name: string | null } | null
  leads: CampaignLeadRow[]
}> {
  const supabase = createClient(project)
  if (!campaignId) return { campaign: null, leads: [] }
  const { data: camp } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("id", campaignId)
    .maybeSingle()
  const { data: lcs } = await supabase
    .from("lead_campaigns")
    .select(
      "lead_id, campaign_id, status, message_status, joined_at, acceptance_detected_at, message_1_sent_at, message_2_sent_at, message_3_sent_at"
    )
    .eq("campaign_id", campaignId)
  const lcRows = (lcs ?? []) as Array<{
    lead_id: string
    campaign_id: string
    status: string | null
    message_status: string | null
    joined_at: string | null
    acceptance_detected_at: string | null
    message_1_sent_at: string | null
    message_2_sent_at: string | null
    message_3_sent_at: string | null
  }>
  if (lcRows.length === 0) {
    return {
      campaign: camp ? { id: camp.id, name: camp.name } : null,
      leads: [],
    }
  }
  const leadIds = lcRows.map((r) => r.lead_id)
  const { data: leads } = await supabase
    .from("leads")
    .select("id, full_name, profile_url, email, company_name, title")
    .in("id", leadIds)
  const leadMap = new Map<string, {
    id: string
    full_name: string | null
    profile_url: string | null
    email: string | null
    company_name: string | null
    title: string | null
  }>()
  for (const l of (leads ?? []) as Array<{
    id: string
    full_name: string | null
    profile_url: string | null
    email: string | null
    company_name: string | null
    title: string | null
  }>) {
    leadMap.set(l.id, l)
  }
  const rows: CampaignLeadRow[] = lcRows.map((r) => {
    const l = leadMap.get(r.lead_id)
    return {
      lead_id: r.lead_id,
      full_name: l?.full_name ?? null,
      profile_url: l?.profile_url ?? null,
      email: l?.email ?? null,
      company_name: l?.company_name ?? null,
      title: l?.title ?? null,
      status: r.status,
      message_status: r.message_status,
      joined_at: r.joined_at,
      acceptance_detected_at: r.acceptance_detected_at,
      message_1_sent_at: r.message_1_sent_at,
      message_2_sent_at: r.message_2_sent_at,
      message_3_sent_at: r.message_3_sent_at,
    }
  })
  return {
    campaign: camp ? { id: camp.id, name: camp.name } : null,
    leads: rows,
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const project = parseProject(url.searchParams.get("project"))
  const mode = url.searchParams.get("mode") ?? "by-lead"
  try {
    if (mode === "by-lead") {
      const q = url.searchParams.get("q") ?? ""
      const leads = await byLead(project, q)
      return NextResponse.json({ mode: "by-lead", leads })
    }
    if (mode === "by-campaign") {
      const campaignId = url.searchParams.get("campaign_id") ?? ""
      const result = await byCampaign(project, campaignId)
      return NextResponse.json({ mode: "by-campaign", ...result })
    }
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load campaign status" },
      { status: 500 }
    )
  }
}
