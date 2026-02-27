import { getSupabase, type SupabaseProject } from "./supabase"
import { getAllCampaigns } from "./campaignQueries"

export type LeadRow = {
  id: string
  name?: string | null
  title?: string | null
  company?: string | null
  location?: string | null
  email?: string | null
  phone?: string | null
  status?: string | null
  tier?: string | null
  score?: number | null
  is_dossier?: boolean | null
  dossier_url?: string | null
  profile_url?: string | null
  profile_picture_url?: string | null
  about_summary?: string | null
  personality?: string | null
  expertise?: string | null
  tech_stack_tags?: string | null
  company_description?: string | null
  followers_count?: number | null
  connections_count?: number | null
  created_at?: string | null
  campaign_name?: string | null
}

export type Stats = {
  total: number
  withDossiers: number
  byStatus: { status: string; value: number }[]
  byTier: { tier: string; value: number }[]
  averageScore: number
}

function parseScore(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

function parseOptionalNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

/** Map raw row to LeadRow (handles different column names in Supabase) */
function mapToLeadRow(row: Record<string, unknown>): LeadRow {
  return {
    id: String(row.id ?? ""),
    name: (row.name ?? row.full_name ?? null) as string | null,
    title: (row.title ?? row.job_title ?? null) as string | null,
    company: (row.company ?? row.company_name ?? null) as string | null,
    location: (row.location ?? row.country ?? null) as string | null,
    email: (row.email ?? null) as string | null,
    phone: (row.phone ?? null) as string | null,
    status: (row.status ?? null) as string | null,
    tier: (row.tier ?? row.tier_level ?? row.lead_tier ?? null) as string | null,
    score: parseScore(row.score ?? row.lead_score ?? row.score_value),
    is_dossier: row.is_dossier === true || row.has_dossier === true,
    dossier_url: (row.dossier_url ?? row.dossier_link ?? row.url ?? null) as string | null,
    profile_url: (row.profile_url ?? row.linkedin_url ?? null) as string | null,
    profile_picture_url: (row.profile_picture_url ?? row.avatar_url ?? row.picture_url ?? null) as string | null,
    about_summary: (row.about_summary ?? row.about ?? row.summary ?? null) as string | null,
    personality: (row.personality ?? null) as string | null,
    expertise: (row.expertise ?? null) as string | null,
    tech_stack_tags: (row.tech_stack_tags ?? row.tech_stack ?? row.skills ?? null) as string | null,
    company_description: (row.company_description ?? null) as string | null,
    followers_count: parseOptionalNumber(row.followers_count ?? row.followers ?? row.follower_count),
    connections_count: parseOptionalNumber(row.connections_count ?? row.connections ?? row.connection_count),
    created_at: (row.created_at ?? null) as string | null,
    campaign_name: (row.campaign_name ?? row.campaign_names ?? null) as string | null,
  }
}

const PAGE_SIZE = 1000

/** Fetch all rows from a table with pagination (Supabase default max is 1000 per request). */
async function fetchAllFromLeads(project: SupabaseProject = "sales2k25"): Promise<Record<string, unknown>[]> {
  const supabase = getSupabase(project)
  const out: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`leads: ${error.message}`)
    const chunk = (data ?? []) as Record<string, unknown>[]
    out.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return out
}

export async function getAllLeads(project: SupabaseProject = "sales2k25"): Promise<LeadRow[]> {
  const rows = await fetchAllFromLeads(project)
  return rows.map(mapToLeadRow)
}

/** Map raw dossiers row to LeadRow; merge with lead if lead_id present and lead data provided */
function mapDossierRow(row: Record<string, unknown>, lead?: LeadRow | null): LeadRow {
  const id = String(row.id ?? row.lead_id ?? "")
  const score = parseScore(row.score ?? row.lead_score ?? row.score_value) ?? lead?.score ?? null
  const tier = (row.tier ?? row.tier_level ?? row.lead_tier ?? lead?.tier ?? null) as string | null
  return {
    id,
    name: (row.name ?? row.lead_name ?? row.full_name ?? lead?.name ?? null) as string | null,
    title: (row.title ?? row.job_title ?? lead?.title ?? null) as string | null,
    company: (row.company ?? row.company_name ?? lead?.company ?? null) as string | null,
    location: (row.location ?? row.country ?? lead?.location ?? null) as string | null,
    email: (row.email ?? lead?.email ?? null) as string | null,
    phone: (row.phone ?? lead?.phone ?? null) as string | null,
    status: (row.status ?? lead?.status ?? null) as string | null,
    tier: tier && String(tier).trim() ? tier : null,
    score,
    is_dossier: true,
    dossier_url: (row.dossier_url ?? row.url ?? row.link ?? row.dossier_link ?? null) as string | null,
    profile_url: (row.profile_url ?? row.linkedin_url ?? lead?.profile_url ?? null) as string | null,
    profile_picture_url: (row.profile_picture_url ?? row.avatar_url ?? lead?.profile_picture_url ?? null) as string | null,
    about_summary: (row.about_summary ?? row.about ?? lead?.about_summary ?? null) as string | null,
    personality: (row.personality ?? lead?.personality ?? null) as string | null,
    expertise: (row.expertise ?? lead?.expertise ?? null) as string | null,
    tech_stack_tags: (row.tech_stack_tags ?? row.tech_stack ?? lead?.tech_stack_tags ?? null) as string | null,
    company_description: (row.company_description ?? lead?.company_description ?? null) as string | null,
    followers_count: parseOptionalNumber(row.followers_count ?? row.followers) ?? lead?.followers_count ?? null,
    connections_count: parseOptionalNumber(row.connections_count ?? row.connections) ?? lead?.connections_count ?? null,
    created_at: (row.created_at ?? null) as string | null,
    campaign_name: (row.campaign_name ?? row.campaign_names ?? lead?.campaign_name ?? null) as string | null,
  }
}

/** Dossiers: try `dossiers` table first (paginated), merge with leads when lead_id present; else leads with dossier set */
export async function getWithDossiers(project: SupabaseProject = "sales2k25"): Promise<LeadRow[]> {
  const supabase = getSupabase(project)
  const dossiersRows: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from("dossiers")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) break
    const chunk = (data ?? []) as Record<string, unknown>[]
    dossiersRows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  if (dossiersRows.length > 0) {
    const leadIds = [...new Set(dossiersRows.map((r) => String(r.lead_id ?? r.id ?? "")).filter(Boolean))]
    const leadsById = new Map<string, LeadRow>()
    if (leadIds.length > 0) {
      const allLeads = await getAllLeads(project)
      for (const l of allLeads) leadsById.set(l.id, l)
    }
    const campaignIds = [...new Set(dossiersRows.map((r) => String(r.campaign_id ?? "")).filter(Boolean))]
    const campaignIdToName = new Map<string, string>()
    if (campaignIds.length > 0) {
      try {
        const campaigns = await getAllCampaigns(project)
        for (const c of campaigns) campaignIdToName.set(c.id, c.name ?? c.id)
      } catch {
        // ignore
      }
    }
    return dossiersRows.map((row) => {
      const leadId = String(row.lead_id ?? row.id ?? "")
      const lead = leadId ? leadsById.get(leadId) : null
      const mapped = mapDossierRow(row, lead)
      if (!(mapped.campaign_name ?? "").trim() && row.campaign_id) {
        const name = campaignIdToName.get(String(row.campaign_id))
        if (name) mapped.campaign_name = name
      }
      return mapped
    })
  }
  const all = await getAllLeads(project)
  return all.filter(
    (l) => l.is_dossier === true || (l.dossier_url != null && String(l.dossier_url).trim() !== "")
  )
}

export async function getStats(project: SupabaseProject = "sales2k25"): Promise<Stats> {
  const leads = await getAllLeads(project)
  const total = leads.length
  const withDossiers = leads.filter((l) => l.is_dossier === true || (l.dossier_url != null && l.dossier_url !== "")).length
  const byStatusMap = new Map<string, number>()
  const byTierMap = new Map<string, number>()
  let scoreSum = 0
  let scoreCount = 0
  for (const l of leads) {
    const s = l.status ?? "Unknown"
    byStatusMap.set(s, (byStatusMap.get(s) ?? 0) + 1)
    const t = l.tier ?? "Unknown"
    byTierMap.set(t, (byTierMap.get(t) ?? 0) + 1)
    if (typeof l.score === "number" && !Number.isNaN(l.score)) {
      scoreSum += l.score
      scoreCount += 1
    }
  }
  const byStatus = Array.from(byStatusMap.entries()).map(([status, value]) => ({ status, value }))
  const byTier = Array.from(byTierMap.entries()).map(([tier, value]) => ({ tier, value }))
  const averageScore = scoreCount ? scoreSum / scoreCount : 0
  return {
    total,
    withDossiers,
    byStatus,
    byTier,
    averageScore,
  }
}

/** Cumulative average score over time (by month from created_at) */
export async function getTimelineData(project: SupabaseProject = "sales2k25"): Promise<{ date: string; score: number }[]> {
  const leads = await getAllLeads(project)
  const withScore = leads
    .filter((l) => typeof l.score === "number" && l.created_at)
    .map((l) => ({ score: l.score as number, created_at: l.created_at! }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  if (withScore.length === 0) return []
  const byMonth = new Map<string, number>()
  let runningSum = 0
  let runningCount = 0
  for (const { score } of withScore) {
    runningSum += score
    runningCount += 1
    const avg = Math.round((runningSum / runningCount) * 10) / 10
    byMonth.set(withScore[runningCount - 1].created_at.slice(0, 7), avg)
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, score]) => ({ date, score }))
}
