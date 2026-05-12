/**
 * In-app enrichment engine: fetch lead profile from Unipile (identifier or search fallback),
 * then fetch top 5 posts and upsert into lead_posts. Updates leads.identifier.
 */

import { createClient, type SupabaseProject } from "@/lib/supabase"
import { getUnipileApiKey, getUnipileAccountId, getUnipileApiBase } from "@/lib/env"
import type { NormalizedLead } from "./campaign-manager-inline"

const POSTS_LIMIT = 5

export type EnrichmentLogEntry = {
  type: "enriched" | "failed" | "skip"
  profile_url: string
  full_name: string | null
  message: string
  postsStored?: number
}

export type EnrichmentSummary = {
  enrichedCount: number
  failedCount: number
  skipCount: number
  logs: EnrichmentLogEntry[]
}

/** Extract identifier and name slug from LinkedIn profile_url. */
export function resolveIdentifierFromProfileUrl(profileUrl: string): {
  identifier: string | null
  latestNameIdentifier: string | null
} {
  const trimmed = (profileUrl ?? "").trim()
  if (!trimmed) return { identifier: null, latestNameIdentifier: null }
  const normalized =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed.replace(/^\/*/, "")}`
  let path = ""
  try {
    path = new URL(normalized).pathname
  } catch {
    // Fallback for malformed URL-like inputs.
    path = trimmed
  }
  const inIndex = path.indexOf("/in/")
  const rawSlug =
    inIndex >= 0
      ? path.slice(inIndex + 4)
      : path.replace(/^\/+/, "")
  const identifier = rawSlug
    .replace(/[?#].*$/, "")
    .replace(/\/.*$/, "")
    .replace(/\/$/, "")
    .trim()
  if (!identifier) return { identifier: null, latestNameIdentifier: null }
  const nameIdentifier = identifier.replace(/-\d+[a-z0-9]*$/i, "")
  const words = nameIdentifier.split("-")
  const latestNameIdentifier = words.length >= 2 ? words.slice(0, 2).join("-") : nameIdentifier
  return { identifier, latestNameIdentifier }
}

function buildSearchKeywords(lead: NormalizedLead, latestNameIdentifier: string | null): string[] {
  const out = new Set<string>()
  const fullName = (lead.full_name ?? "").trim()
  const company = (lead.company_name ?? "").trim()
  if (latestNameIdentifier) out.add(latestNameIdentifier)
  if (fullName) out.add(fullName)
  if (fullName && company) out.add(`${fullName} ${company}`)
  if (fullName) out.add(fullName.replace(/\s+/g, "-").toLowerCase())
  return Array.from(out).filter(Boolean)
}

/** Unipile profile (subset we use). */
type UnipileProfile = {
  provider_id?: string
  headline?: string
  summary?: string
  work_experience?: Array<{ company?: string }>
  follower_count?: number
  connections_count?: number
  contact_info?: { emails?: string[]; phones?: string[] }
  profile_picture_url?: string
  /** Connection degree when present (e.g. 1, 2, 3 or "1st", "2nd") */
  degree?: string | number
  connection_degree?: string | number
  [k: string]: unknown
}

/** Unipile post (subset we use). */
type UnipilePost = {
  social_id?: string
  repost_id?: string
  share_url?: string
  text?: string
  date?: string
  reaction_counter?: number
  comment_counter?: number
  is_repost?: boolean
  parsed_datetime?: string
}

function unipileFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const base = getUnipileApiBase()
  const key = getUnipileApiKey()
  const accountId = getUnipileAccountId()
  if (!key) throw new Error("UNIPILE_API_KEY not set")
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`
  const headers = new Headers(options.headers as HeadersInit)
  headers.set("X-API-KEY", key)
  headers.set("accept", "application/json")
  return fetch(url, { ...options, headers })
}

/** GET /api/v1/users/{{ identifier }} — returns profile or null. */
export async function fetchUnipileProfile(identifier: string): Promise<UnipileProfile | null> {
  const result = await fetchUnipileProfileWithDetails(identifier)
  return result.profile
}

const MAX_RESPONSE_SNIPPET = 600

/** GET /api/v1/users/{{ identifier }} with status and response for logging. */
export async function fetchUnipileProfileWithDetails(identifier: string): Promise<{
  profile: UnipileProfile | null
  statusCode: number
  responseSnippet: string
  degree: string | null
}> {
  const accountId = getUnipileAccountId()
  const q = new URLSearchParams({ linkedin_sections: "*", account_id: accountId || "" })
  const res = await unipileFetch(`/api/v1/users/${encodeURIComponent(identifier)}?${q}`)
  const rawText = await res.text()
  let profile: UnipileProfile | null = null
  let degree: string | null = null
  try {
    const data = JSON.parse(rawText) as UnipileProfile & { degree?: string | number; connection_degree?: string | number }
    if (data?.provider_id) profile = data
    if (data?.degree != null) degree = String(data.degree)
    else if (data?.connection_degree != null) degree = String(data.connection_degree)
  } catch {
    // leave profile null
  }
  const responseSnippet = rawText.length > MAX_RESPONSE_SNIPPET ? rawText.slice(0, MAX_RESPONSE_SNIPPET) + "…" : rawText
  return { profile, statusCode: res.status, responseSnippet, degree }
}

/** POST /api/v1/users/invite — send LinkedIn connection request. accountId = Unipile connected account to send from. */
export async function sendUnipileInvite(
  accountId: string,
  providerId: string,
  message?: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await sendUnipileInviteWithDetails(accountId, providerId, message)
  return { ok: result.ok, error: result.error }
}

/**
 * POST /api/v1/chats — send a LinkedIn DM to a 1st-degree connection.
 *
 * Unipile dedupes the chat by attendee, so calling this for M1/M2/M3 simply
 * appends new messages to the existing thread. If the lead un-accepted the
 * connection between passes, Unipile returns a non-2xx and the messaging pass
 * decides transient-vs-permanent via the shared `isTransient` heuristic.
 */
export async function sendUnipileMessageWithDetails(
  accountId: string,
  providerId: string,
  text: string
): Promise<{
  ok: boolean
  statusCode: number
  responseSnippet: string
  error?: string
}> {
  const res = await unipileFetch("/api/v1/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: accountId,
      attendees_ids: [providerId],
      text,
    }),
  })
  const rawText = await res.text()
  const responseSnippet =
    rawText.length > MAX_RESPONSE_SNIPPET ? rawText.slice(0, MAX_RESPONSE_SNIPPET) + "…" : rawText
  if (res.ok) return { ok: true, statusCode: res.status, responseSnippet }
  return { ok: false, statusCode: res.status, responseSnippet, error: `${res.status}: ${rawText}` }
}

/** POST /api/v1/users/invite with status and response for logging. */
export async function sendUnipileInviteWithDetails(
  accountId: string,
  providerId: string,
  message?: string
): Promise<{
  ok: boolean
  statusCode: number
  responseSnippet: string
  error?: string
}> {
  const res = await unipileFetch("/api/v1/users/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: accountId,
      provider_id: providerId,
      ...(message != null && message !== "" ? { message } : {}),
    }),
  })
  const rawText = await res.text()
  const responseSnippet = rawText.length > MAX_RESPONSE_SNIPPET ? rawText.slice(0, MAX_RESPONSE_SNIPPET) + "…" : rawText
  if (res.ok) return { ok: true, statusCode: res.status, responseSnippet }
  return { ok: false, statusCode: res.status, responseSnippet, error: `${res.status}: ${rawText}` }
}

/** POST /api/v1/linkedin/search (people by keywords) */
export async function searchUnipilePeople(keywords: string): Promise<Array<{ id: string }>> {
  const details = await searchUnipilePeopleWithDetails(keywords)
  return details.items
}

/** POST /api/v1/linkedin/search with status and response snippet for diagnostics. */
export async function searchUnipilePeopleWithDetails(keywords: string): Promise<{
  items: Array<{ id: string }>
  statusCode: number
  responseSnippet: string
  requestPath: string
  requestBody: Record<string, string>
}> {
  const accountId = getUnipileAccountId()
  const requestPath = `/api/v1/linkedin/search?limit=2&account_id=${encodeURIComponent(accountId)}`
  const requestBody = { api: "classic", category: "people", keywords }
  const res = await unipileFetch(requestPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  })
  const rawText = await res.text()
  const responseSnippet =
    rawText.length > MAX_RESPONSE_SNIPPET ? rawText.slice(0, MAX_RESPONSE_SNIPPET) + "…" : rawText
  if (!res.ok) {
    return {
      items: [],
      statusCode: res.status,
      responseSnippet,
      requestPath,
      requestBody,
    }
  }
  let items: Array<{ id?: string }> = []
  try {
    const data = JSON.parse(rawText) as { items?: Array<{ id?: string }> }
    items = data?.items ?? []
  } catch {
    items = []
  }
  return {
    items: items.filter((i) => i.id).map((i) => ({ id: i.id! })),
    statusCode: res.status,
    responseSnippet,
    requestPath,
    requestBody,
  }
}

/** GET /api/v1/users/{{ providerId }}/posts */
export async function fetchUnipilePosts(providerId: string): Promise<UnipilePost[]> {
  const accountId = getUnipileAccountId()
  const q = new URLSearchParams({
    limit: String(POSTS_LIMIT),
    is_company: "false",
    account_id: accountId || "",
  })
  const res = await unipileFetch(`/api/v1/users/${encodeURIComponent(providerId)}/posts?${q}`)
  if (!res.ok) return []
  const data = (await res.json()) as { items?: UnipilePost[] }
  const items = data?.items ?? []
  return Array.isArray(items) ? items : []
}

/** GET /api/v1/posts/{{ postId }}/comments — returns list of comments (commentators). */
export async function fetchUnipilePostComments(postId: string): Promise<unknown[]> {
  const accountId = getUnipileAccountId()
  const q = new URLSearchParams({ account_id: accountId || "" })
  const res = await unipileFetch(`/api/v1/posts/${encodeURIComponent(postId)}/comments?${q}`)
  if (!res.ok) return []
  const data = (await res.json()) as { items?: unknown[] }
  return Array.isArray(data?.items) ? data.items : []
}

/** GET /api/v1/posts/{{ postId }}/reactions — returns list of reactions (reactioners). */
export async function fetchUnipilePostReactions(postId: string): Promise<unknown[]> {
  const accountId = getUnipileAccountId()
  const q = new URLSearchParams({ account_id: accountId || "" })
  const res = await unipileFetch(`/api/v1/posts/${encodeURIComponent(postId)}/reactions?${q}`)
  if (!res.ok) return []
  const data = (await res.json()) as { items?: unknown[] }
  return Array.isArray(data?.items) ? data.items : []
}

/** Map Unipile post to lead_posts row shape (with optional commentators + reactioners). */
function mapPostToLeadPost(
  post: UnipilePost,
  leadId: string,
  leadName: string | null,
  leadCompany: string | null,
  createdAt: string,
  commentators: unknown[] | null,
  reactioners: unknown[] | null
): Record<string, unknown> {
  const postUrl = post.share_url ? post.share_url.split("?")[0] : null
  let linkedinPostId: string | null = null
  if (post.is_repost && post.repost_id) {
    linkedinPostId = post.repost_id.startsWith("urn:li:") ? post.repost_id : `urn:li:activity:${post.repost_id}`
  } else if (post.social_id) {
    linkedinPostId = post.social_id
  }
  if (!linkedinPostId) linkedinPostId = `urn:li:activity:${Date.now()}-${Math.random().toString(36).slice(2)}`
  return {
    lead_id: leadId,
    lead_name: leadName ?? null,
    lead_company: leadCompany ?? null,
    content: post.text ?? null,
    post_url: postUrl,
    linkedin_post_id: linkedinPostId,
    reactions: post.reaction_counter ?? null,
    comments: post.comment_counter ?? null,
    is_repost: !!post.is_repost,
    created_at: createdAt,
    updated_at: new Date().toISOString(),
    commentators: commentators && commentators.length > 0 ? commentators : null,
    reactioners: reactioners && reactioners.length > 0 ? reactioners : null,
  }
}

/** Update lead.identifier (and optional fields) in Supabase. */
async function updateLeadIdentifier(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  identifier: string,
  profile: UnipileProfile | null
): Promise<void> {
  const row: Record<string, unknown> = {
    identifier,
    updated_at: new Date().toISOString(),
  }
  if (profile) {
    if (profile.headline != null) row.description = profile.headline
    const summaryText =
      typeof profile.summary === "string" && profile.summary.trim()
        ? profile.summary.trim()
        : typeof (profile as Record<string, unknown>)["about"] === "string"
          ? String((profile as Record<string, unknown>)["about"]).trim()
          : null
    if (summaryText) row.about_summary = summaryText
    if (profile.work_experience?.[0]?.company != null) row.company_name = profile.work_experience[0].company
    if (profile.follower_count != null) row.followers_count = profile.follower_count
    if (profile.connections_count != null) row.connections_count = profile.connections_count
    if (profile.contact_info?.emails?.[0] != null) row.email = profile.contact_info.emails[0]
    if (profile.contact_info?.phones?.[0] != null) row.phone = profile.contact_info.phones[0]
    if (profile.profile_picture_url != null) row.profile_picture_url = profile.profile_picture_url
    row.status = "enriched"
  }
  await supabase.from("leads").update(row).eq("id", leadId)
}

/** Upsert lead_posts (by linkedin_post_id). */
async function upsertLeadPosts(
  supabase: ReturnType<typeof createClient>,
  posts: Record<string, unknown>[]
): Promise<void> {
  if (posts.length === 0) return
  for (const row of posts) {
    const { error } = await supabase.from("lead_posts").upsert(row, {
      onConflict: "linkedin_post_id",
      ignoreDuplicates: false,
    })
    if (error) throw new Error(`lead_posts upsert: ${error.message}`)
  }
}

/** Run enrichment for a single lead: resolve profile, fetch posts, update lead + upsert posts. */
export async function runEnrichmentForLead(
  project: SupabaseProject,
  lead: NormalizedLead,
  leadId: string,
  streamLog: (entry: EnrichmentLogEntry) => void
): Promise<{ success: boolean; postsStored: number; error?: string }> {
  const profileUrl = (lead.profile_url ?? "").trim()
  const fullName = lead.full_name ?? null
  if (!profileUrl) {
    streamLog({ type: "skip", profile_url: "", full_name: fullName, message: "Missing profile_url" })
    return { success: false, postsStored: 0, error: "Missing profile_url" }
  }

  const { identifier: slug, latestNameIdentifier } = resolveIdentifierFromProfileUrl(profileUrl)
  let providerId: string | null = null
  let profile: UnipileProfile | null = null

  if (slug) {
    profile = await fetchUnipileProfile(slug)
    if (profile?.provider_id) providerId = profile.provider_id
  }

  if (!providerId) {
    const searchKeywords = buildSearchKeywords(lead, latestNameIdentifier)
    for (const keywords of searchKeywords) {
      const searchResults = await searchUnipilePeople(keywords)
      if (searchResults.length === 0) continue
      const searchId = searchResults[0].id
      profile = await fetchUnipileProfile(searchId)
      if (profile?.provider_id) {
        providerId = profile.provider_id
        break
      }
    }
  }

  if (!providerId) {
    const msg = "Profile not found (direct + search fallback)"
    streamLog({ type: "failed", profile_url: profileUrl, full_name: fullName, message: msg })
    return { success: false, postsStored: 0, error: msg }
  }

  const supabase = createClient(project)
  try {
    await updateLeadIdentifier(supabase, leadId, providerId, profile)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    streamLog({ type: "failed", profile_url: profileUrl, full_name: fullName, message: `Update lead: ${msg}` })
    return { success: false, postsStored: 0, error: msg }
  }

  const rawPosts = await fetchUnipilePosts(providerId)
  const createdAt = rawPosts[0]?.parsed_datetime ?? new Date().toISOString()
  const leadCompany = profile?.work_experience?.[0]?.company ?? lead.company_name ?? null
  const posts: Record<string, unknown>[] = []
  for (const p of rawPosts) {
    let linkedinPostId: string | null = null
    if (p.is_repost && p.repost_id) {
      linkedinPostId = p.repost_id.startsWith("urn:li:") ? p.repost_id : `urn:li:activity:${p.repost_id}`
    } else if (p.social_id) {
      linkedinPostId = p.social_id
    }
    if (!linkedinPostId) linkedinPostId = `urn:li:activity:${Date.now()}-${Math.random().toString(36).slice(2)}`
    let commentators: unknown[] | null = null
    let reactioners: unknown[] | null = null
    try {
      commentators = await fetchUnipilePostComments(linkedinPostId)
    } catch {
      // non-fatal
    }
    try {
      reactioners = await fetchUnipilePostReactions(linkedinPostId)
    } catch {
      // non-fatal
    }
    posts.push(mapPostToLeadPost(p, leadId, fullName, leadCompany, createdAt, commentators, reactioners))
  }
  try {
    await upsertLeadPosts(supabase, posts)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    streamLog({ type: "failed", profile_url: profileUrl, full_name: fullName, message: `Posts upsert: ${msg}` })
    return { success: false, postsStored: 0, error: msg }
  }

  streamLog({
    type: "enriched",
    profile_url: profileUrl,
    full_name: fullName,
    message: `Enriched, ${posts.length} posts stored`,
    postsStored: posts.length,
  })
  return { success: true, postsStored: posts.length }
}

/** Run enrichment for all campaign leads; collect logs and summary. */
export async function runEnrichmentForCampaign(
  project: SupabaseProject,
  normalized: NormalizedLead[],
  leadIdsByProfileUrl: Map<string, string>,
  streamLine: (obj: Record<string, unknown>) => void
): Promise<EnrichmentSummary> {
  const logs: EnrichmentLogEntry[] = []
  const streamLog = (entry: EnrichmentLogEntry) => {
    logs.push(entry)
    streamLine({ enrichment_log: entry })
  }

  let enrichedCount = 0
  let failedCount = 0
  let skipCount = 0
  const total = normalized.length
  let processed = 0

  // Initial progress beacon so the UI can render the bar from 0/N.
  streamLine({ enrichment_progress: { done: 0, total, currentLead: null } })

  for (let i = 0; i < normalized.length; i++) {
    const lead = normalized[i]
    const profileUrl = (lead.profile_url ?? "").trim()
    const leadName = lead.full_name ?? null

    streamLine({
      enrichment_progress: {
        done: processed,
        total,
        currentLead: leadName ?? profileUrl ?? `Row ${i + 1}`,
        index: i + 1,
      },
    })

    if (!profileUrl) {
      skipCount++
      streamLog({ type: "skip", profile_url: "", full_name: leadName, message: "No profile_url" })
      processed++
      continue
    }
    const leadId = leadIdsByProfileUrl.get(profileUrl)
    if (!leadId) {
      skipCount++
      streamLog({ type: "skip", profile_url: profileUrl, full_name: leadName, message: "Lead id not found" })
      processed++
      continue
    }

    try {
      const result = await runEnrichmentForLead(project, lead, leadId, streamLog)
      if (result.success) enrichedCount++
      else failedCount++
    } catch (e) {
      failedCount++
      const msg = e instanceof Error ? e.message : String(e)
      streamLog({ type: "failed", profile_url: profileUrl, full_name: leadName, message: msg })
    }
    processed++
  }

  // Final beacon shows N/N so the bar lands at 100%.
  streamLine({ enrichment_progress: { done: total, total, currentLead: null } })

  const summary: EnrichmentSummary = { enrichedCount, failedCount, skipCount, logs }
  streamLine({ enrichment_summary: summary })
  return summary
}
