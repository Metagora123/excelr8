import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { getUnipileApiKey, getUnipileAccountId, getUnipileApiBase } from "@/lib/env"

export type RadarPerson = {
  id: string
  name: string
  headline?: string
  profile_url?: string
  type?: "commentator" | "reactioner"
  text?: string
  date?: string
  reaction_type?: string
}

export type NormalizedPostData = {
  content: string
  reactionsCount: number
  commentsCount: number
  postUrl: string
  linkedinPostId: string | null
  createdAt: string | null
  authorName?: string
  authorHeadline?: string
  commentators: RadarPerson[]
  reactioners: RadarPerson[]
}

export type RadarResult = {
  postData: NormalizedPostData
  source: "supabase" | "unipile"
}

/** Steps recorded for Post Radar Logging page (no secrets). */
export type RadarTraceStep = {
  order: number
  phase: string
  title: string
  service: "internal" | "supabase" | "unipile"
  httpMethod?: string
  endpoint: string
  requestSummary: Record<string, unknown>
  responseStatus?: number
  responseSummary?: string
}

function appendTrace(trace: RadarTraceStep[] | undefined, partial: Omit<RadarTraceStep, "order">) {
  if (!trace) return
  trace.push({ ...partial, order: trace.length + 1 })
}

function maskAccountId(id: string): string {
  const t = id.trim()
  if (!t) return "(empty)"
  if (t.length <= 6) return "****"
  return `${t.slice(0, 4)}…${t.slice(-2)}`
}

function redactAccountInUrl(url: string, accountId: string): string {
  if (!accountId) return url
  return url.split(encodeURIComponent(accountId)).join(maskAccountId(accountId)).split(accountId).join(maskAccountId(accountId))
}

function unipileV1Base(): string {
  return `${getUnipileApiBase()}/api/v1`
}

/** Unipile docs: GET /users/{identifier} - identifier can be public_identifier (slug) or provider_id. */
async function fetchUnipileUserProfile(identifier: string): Promise<{
  profile_url: string
  headline?: string
} | null> {
  const apiKey = getUnipileApiKey()
  const accountId = getUnipileAccountId()
  if (!apiKey || !accountId) return null
  const encoded = encodeURIComponent(identifier)
  const url = `${unipileV1Base()}/users/${encoded}?account_id=${accountId}`
  try {
    const res = await fetch(url, {
      headers: { "X-API-KEY": apiKey, accept: "application/json" },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const publicId = (data.public_identifier as string) ?? identifier
    const profileUrl =
      (data.profile_url as string) ||
      (publicId && publicId.startsWith("http") ? publicId : `https://www.linkedin.com/in/${publicId}`)
    const headline = (data.headline as string) || undefined
    return { profile_url: profileUrl.trim(), headline: headline?.trim() || undefined }
  } catch {
    return null
  }
}

/** Extract identifier (provider_id or public_identifier) from raw Unipile person object for GET /users/{id}. */
function getIdentifierFromPerson(person: Record<string, unknown> | null | undefined): string | null {
  if (!person || typeof person !== "object") return null
  const v =
    (person.provider_id as string) ??
    (person.id as string) ??
    (person.public_identifier as string) ??
    (person.linkedin_id as string)
  if (v != null && String(v).trim()) return String(v).trim()
  return null
}

/** Enrich commentators and reactioners missing profile_url by calling Unipile GET /users/{identifier}. */
async function enrichWithUnipileProfiles(
  commentators: RadarPerson[],
  reactioners: RadarPerson[],
  rawComments: Record<string, unknown>[],
  rawReactions: Record<string, unknown>[]
): Promise<void> {
  const getPersonFromItem = (item: Record<string, unknown>, forComment: boolean): Record<string, unknown> | null => {
    const candidates = forComment
      ? [
          item.author_details,
          item.creator,
          item.posted_by,
          item.comment_author,
          item.author,
          item.owner,
          item.commenter,
          item.user,
          item.from,
          item.member,
          item.person,
          item.profile,
          item.actor,
        ]
      : [item.author, item.actor, item.actor_details, item.owner, item.user, item.from]
    for (const c of candidates) {
      if (c && typeof c === "object" && !Array.isArray(c)) return c as Record<string, unknown>
    }
    return null
  }

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

  for (let i = 0; i < commentators.length; i++) {
    if (commentators[i].profile_url?.trim()) continue
    const raw = rawComments[i]
    if (!raw) continue
    const person = getPersonFromItem(raw, true)
    const id = getIdentifierFromPerson(person)
    if (!id) continue
    const profile = await fetchUnipileUserProfile(id)
    if (profile) {
      commentators[i].profile_url = profile.profile_url
      if (profile.headline && !commentators[i].headline) commentators[i].headline = profile.headline
    }
    await delay(180)
  }

  for (let i = 0; i < reactioners.length; i++) {
    if (reactioners[i].profile_url?.trim()) continue
    const raw = rawReactions[i]
    if (!raw) continue
    const person = getPersonFromItem(raw, false)
    const id = getIdentifierFromPerson(person)
    if (!id) continue
    const profile = await fetchUnipileUserProfile(id)
    if (profile) {
      reactioners[i].profile_url = profile.profile_url
      if (profile.headline && !reactioners[i].headline) reactioners[i].headline = profile.headline
    }
    await delay(180)
  }
}

/**
 * LinkedIn post URLs encode the entity type in the path (activity / ugcPost / share).
 * Unipile expects the matching URN: urn:li:activity, urn:li:ugcPost, or urn:li:share
 * (see Unipile "Posts and Comments" docs). Using activity for a ugc/share id often fails.
 */
function extractPostRef(url: string): { postId: string; urn: string } | null {
  const mActivityUrn = url.match(/urn:li:activity:(\d+)/i)
  if (mActivityUrn?.[1]) {
    const id = mActivityUrn[1]
    return { postId: id, urn: `urn:li:activity:${id}` }
  }
  const mUgcUrn = url.match(/urn:li:ugcPost:(\d+)/i)
  if (mUgcUrn?.[1]) {
    const id = mUgcUrn[1]
    return { postId: id, urn: `urn:li:ugcPost:${id}` }
  }
  const mShareUrn = url.match(/urn:li:share:(\d+)/i)
  if (mShareUrn?.[1]) {
    const id = mShareUrn[1]
    return { postId: id, urn: `urn:li:share:${id}` }
  }
  const mUgcSlug = url.match(/ugcPost-(\d+)/i)
  if (mUgcSlug?.[1]) {
    const id = mUgcSlug[1]
    return { postId: id, urn: `urn:li:ugcPost:${id}` }
  }
  const mShareSlug = url.match(/share-(\d+)/i)
  if (mShareSlug?.[1]) {
    const id = mShareSlug[1]
    return { postId: id, urn: `urn:li:share:${id}` }
  }
  const mActivitySlug = url.match(/activity-(\d+)/i)
  if (mActivitySlug?.[1]) {
    const id = mActivitySlug[1]
    return { postId: id, urn: `urn:li:activity:${id}` }
  }
  const mPostsActivity = url.match(/\/posts\/[^/]*activity-(\d+)/i)
  if (mPostsActivity?.[1]) {
    const id = mPostsActivity[1]
    return { postId: id, urn: `urn:li:activity:${id}` }
  }
  const mPostsUgc = url.match(/\/posts\/[^/]*ugcPost-(\d+)/i)
  if (mPostsUgc?.[1]) {
    const id = mPostsUgc[1]
    return { postId: id, urn: `urn:li:ugcPost:${id}` }
  }
  const mPostsShare = url.match(/\/posts\/[^/]*share-(\d+)/i)
  if (mPostsShare?.[1]) {
    const id = mPostsShare[1]
    return { postId: id, urn: `urn:li:share:${id}` }
  }
  return null
}

async function searchSupabase(postId: string, trace?: RadarTraceStep[]): Promise<Record<string, unknown> | null> {
  const attemptLabels = [
    `lead_posts.linkedin_post_id = urn:li:activity:${postId}`,
    `lead_posts.linkedin_post_id = urn:li:ugcPost:${postId}`,
    `lead_posts.linkedin_post_id = urn:li:share:${postId}`,
    `lead_posts.post_url ILIKE %activity-${postId}%`,
    `lead_posts.post_url ILIKE %ugcPost-${postId}%`,
    `lead_posts.post_url ILIKE %share-${postId}%`,
  ]
  try {
    const supabase = getSupabase()
    const activityUrn = `urn:li:activity:${postId}`
    const ugcUrn = `urn:li:ugcPost:${postId}`
    const shareUrn = `urn:li:share:${postId}`

    const attempts = [
      supabase.from("lead_posts").select("*").eq("linkedin_post_id", activityUrn).maybeSingle(),
      supabase.from("lead_posts").select("*").eq("linkedin_post_id", ugcUrn).maybeSingle(),
      supabase.from("lead_posts").select("*").eq("linkedin_post_id", shareUrn).maybeSingle(),
      supabase.from("lead_posts").select("*").ilike("post_url", `%activity-${postId}%`).maybeSingle(),
      supabase.from("lead_posts").select("*").ilike("post_url", `%ugcPost-${postId}%`).maybeSingle(),
      supabase.from("lead_posts").select("*").ilike("post_url", `%share-${postId}%`).maybeSingle(),
    ]

    for (let i = 0; i < attempts.length; i++) {
      const { data, error } = await attempts[i]
      appendTrace(trace, {
        phase: "supabase",
        title: `Supabase lead_posts lookup (${i + 1}/6)`,
        service: "supabase",
        httpMethod: "GET",
        endpoint: "Supabase REST `lead_posts` (via @supabase/supabase-js)",
        requestSummary: { table: "lead_posts", filter: attemptLabels[i] },
        responseStatus: error ? 400 : 200,
        responseSummary: data
          ? "Row found — using Supabase for post + commentators + reactioners"
          : error
            ? String(error.message ?? error)
            : "No row",
      })
      if (!error && data) return data as Record<string, unknown>
    }
  } catch (e) {
    appendTrace(trace, {
      phase: "supabase",
      title: "Supabase lead_posts — exception",
      service: "supabase",
      httpMethod: "GET",
      endpoint: "Supabase REST `lead_posts`",
      requestSummary: { postId },
      responseSummary: e instanceof Error ? e.message : "unknown error",
    })
  }
  return null
}

function normalizeSupabaseData(row: Record<string, unknown>): NormalizedPostData {
  const commentators = (row.commentators as Record<string, unknown>[] | undefined) ?? []
  const reactioners = (row.reactioners as Record<string, unknown>[] | undefined) ?? []

  const toPerson = (p: Record<string, unknown>, i: number, type: "commentator" | "reactioner"): RadarPerson => {
    const explicit = [p.name, p.lead_name].find((x) => x != null && String(x).trim())
    const resolvedName =
      explicit != null ? String(explicit).trim() : extractName(p)
    return {
      id: String((p.id ?? p.profile_url ?? i) ?? `supabase-${type}-${i}`),
      name: resolvedName,
      headline: p.headline != null ? String(p.headline) : undefined,
      profile_url: p.profile_url != null ? String(p.profile_url) : undefined,
      type,
      text: p.text != null ? String(p.text) : undefined,
      date: p.date != null ? String(p.date) : undefined,
      reaction_type: p.reaction_type != null ? String(p.reaction_type) : undefined,
    }
  }

  const reactionsCount = Number(row.reactions ?? 0) || reactioners.length
  const commentsCount = Number(row.comments ?? 0) || commentators.length

  return {
    content: String(row.content ?? ""),
    reactionsCount,
    commentsCount,
    postUrl: String(row.post_url ?? ""),
    linkedinPostId: row.linkedin_post_id != null ? String(row.linkedin_post_id) : null,
    createdAt: row.created_at != null ? String(row.created_at) : null,
    authorName: row.lead_name != null ? String(row.lead_name) : undefined,
    authorHeadline: row.lead_company != null ? String(row.lead_company) : undefined,
    commentators: commentators.map((p, i) => toPerson(p as Record<string, unknown>, i, "commentator")),
    reactioners: reactioners.map((p, i) => toPerson(p as Record<string, unknown>, i, "reactioner")),
  }
}

/** All LinkedIn-style URNs Unipile may accept for the same numeric post id (try until one works). */
function unipileCandidateUrns(postId: string, preferredUrn: string): string[] {
  const all = [
    `urn:li:activity:${postId}`,
    `urn:li:ugcPost:${postId}`,
    `urn:li:share:${postId}`,
  ]
  const rest = all.filter((u) => u !== preferredUrn)
  return [preferredUrn, ...rest]
}

/**
 * Unipile docs: use the post object's `social_id` for comments/reactions.
 * Feed URLs often pass `urn:li:activity:…` (repost wrapper) while engagement lives on `urn:li:ugcPost:…`.
 */
function canonicalPostUrnForEngagement(postJson: Record<string, unknown>, requestUrn: string): string {
  for (const key of ["social_id", "id"] as const) {
    const v = postJson[key]
    if (v != null && String(v).trim().startsWith("urn:li:")) return String(v).trim()
  }
  return requestUrn
}

async function fetchFromUnipile(
  postUrn: string,
  trace?: RadarTraceStep[]
): Promise<{
  postData: unknown
  comments: { items?: unknown[] }
  reactions: { items?: unknown[] }
} | null> {
  const apiKey = getUnipileApiKey()
  const accountId = getUnipileAccountId()
  if (!apiKey || !accountId) return null

  const params = new URLSearchParams({ account_id: accountId })
  const headers: Record<string, string> = {
    "X-API-KEY": apiKey,
    accept: "application/json",
  }

  console.log("[Radar] Step 1: Fetching from Unipile", { postUrn, account_id: accountId })

  const encodedRequest = encodeURIComponent(postUrn)
  const postUrlFull = `${unipileV1Base()}/posts/${encodedRequest}?${params}`
  const postRes = await fetch(postUrlFull, { headers })

  let postErrDetail = ""
  if (!postRes.ok) {
    try {
      const errBody = await postRes.clone().json().catch(() => null) as Record<string, unknown> | null
      const t = errBody?.type ?? errBody?.title
      const d = errBody?.detail
      if (t != null || d != null) postErrDetail = [String(t ?? ""), String(d ?? "")].filter(Boolean).join(" — ")
    } catch {
      /* ignore */
    }
    console.log("[Radar] Step 1 failed: post fetch not ok", {
      status: postRes.status,
      postUrn,
      ...(postErrDetail ? { unipileError: postErrDetail } : {}),
    })
  }

  appendTrace(trace, {
    phase: "unipile",
    title: "Unipile GET — retrieve post",
    service: "unipile",
    httpMethod: "GET",
    endpoint: redactAccountInUrl(postUrlFull, accountId),
    requestSummary: {
      postUrn,
      query: { account_id: maskAccountId(accountId) },
      headers: ["X-API-KEY: (secret)", "accept: application/json"],
    },
    responseStatus: postRes.status,
    responseSummary: postRes.ok
      ? "OK — post JSON (object, text, counters, etc.)"
      : postErrDetail || `HTTP ${postRes.status}`,
  })

  if (!postRes.ok) {
    return null
  }

  const postData = (await postRes.json()) as Record<string, unknown>
  const engagementUrn = canonicalPostUrnForEngagement(postData, postUrn)
  const encodedEngagement = encodeURIComponent(engagementUrn)
  const engagementBase = `${unipileV1Base()}/posts/${encodedEngagement}`
  const commentsUrlFull = `${engagementBase}/comments?${params}`
  const reactionsUrlFull = `${engagementBase}/reactions?${params}`

  // #region agent log
  fetch("http://127.0.0.1:7368/ingest/1596dd21-8bb8-43b4-8ac9-d0757ec24e6d", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b4cedd" },
    body: JSON.stringify({
      sessionId: "b4cedd",
      runId: "radar-engagement-urn",
      hypothesisId: "H1",
      location: "route.ts:fetchFromUnipile",
      message: "Post fetched; URNs for comments/reactions",
      data: {
        requestUrn: postUrn,
        postSocialId: postData.social_id != null ? String(postData.social_id) : null,
        postIdField: postData.id != null ? String(postData.id) : null,
        engagementUrnUsed: engagementUrn,
        switched: engagementUrn !== postUrn,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  if (engagementUrn !== postUrn) {
    appendTrace(trace, {
      phase: "unipile",
      title: "Resolved engagement URN (social_id / id)",
      service: "internal",
      endpoint: "(from GET post body)",
      requestSummary: {
        requestUrn: postUrn,
        engagementUrn,
        note: "Comments and reactions are requested with engagementUrn per Unipile LinkedIn behavior",
      },
      responseSummary: "Using canonical post id for /comments and /reactions",
    })
  }

  const [commentsRes, reactionsRes] = await Promise.all([
    fetch(commentsUrlFull, { headers }),
    fetch(reactionsUrlFull, { headers }),
  ])

  const summarizeList = async (res: Response) => {
    if (!res.ok) return `HTTP ${res.status}`
    const j = (await res.clone().json().catch(() => ({}))) as { items?: unknown[] }
    const n = Array.isArray(j.items) ? j.items.length : 0
    return `HTTP ${res.status}, items: ${n}`
  }
  const commentsSummary = await summarizeList(commentsRes)
  const reactionsSummary = await summarizeList(reactionsRes)

  appendTrace(trace, {
    phase: "unipile",
    title: "Unipile GET — list comments (commentators)",
    service: "unipile",
    httpMethod: "GET",
    endpoint: redactAccountInUrl(commentsUrlFull, accountId),
    requestSummary: {
      postUrnForEngagement: engagementUrn,
      query: { account_id: maskAccountId(accountId) },
      pathSuffix: "/comments",
    },
    responseStatus: commentsRes.status,
    responseSummary: commentsSummary,
  })

  appendTrace(trace, {
    phase: "unipile",
    title: "Unipile GET — list reactions (reactioners)",
    service: "unipile",
    httpMethod: "GET",
    endpoint: redactAccountInUrl(reactionsUrlFull, accountId),
    requestSummary: {
      postUrnForEngagement: engagementUrn,
      query: { account_id: maskAccountId(accountId) },
      pathSuffix: "/reactions",
    },
    responseStatus: reactionsRes.status,
    responseSummary: reactionsSummary,
  })

  const comments = commentsRes.ok ? await commentsRes.json() : { items: [] }
  const reactions = reactionsRes.ok ? await reactionsRes.json() : { items: [] }

  const commentsCount = Array.isArray(comments.items) ? comments.items.length : 0
  const reactionsCount = Array.isArray(reactions.items) ? reactions.items.length : 0
  console.log("[Radar] Step 2: Unipile responses received", {
    engagementUrn,
    commentsCount,
    reactionsCount,
    commentsItems: comments.items != null ? "present" : "missing",
    reactionsItems: reactions.items != null ? "present" : "missing",
  })

  return { postData, comments, reactions }
}

/** Try URL-inferred URN first, then the other two numeric-id variants before giving up. */
async function fetchFromUnipileWithFallback(
  postId: string,
  preferredUrn: string,
  trace?: RadarTraceStep[]
): Promise<{
  postData: unknown
  comments: { items?: unknown[] }
  reactions: { items?: unknown[] }
} | null> {
  const candidates = unipileCandidateUrns(postId, preferredUrn)
  const apiKey = getUnipileApiKey()
  const accountId = getUnipileAccountId()
  if (!apiKey || !accountId) {
    appendTrace(trace, {
      phase: "unipile",
      title: "Unipile — not configured",
      service: "unipile",
      endpoint: `${unipileV1Base()}/posts/...`,
      requestSummary: {
        reason: "Set UNIPILE_API_KEY and UNIPILE_ACCOUNT_ID",
      },
      responseSummary: "No HTTP requests sent",
    })
    return null
  }

  appendTrace(trace, {
    phase: "unipile",
    title: "Unipile URN fallback order",
    service: "internal",
    endpoint: "(local)",
    requestSummary: {
      postId,
      preferredUrn,
      tryInOrder: candidates,
      note: "Each candidate: GET post, then GET /comments + /reactions using post.social_id (or id) when different from request URN",
    },
    responseSummary: "starting attempts",
  })
  for (const urn of candidates) {
    appendTrace(trace, {
      phase: "unipile",
      title: `Unipile batch — trying postUrn`,
      service: "unipile",
      endpoint: `${unipileV1Base()}/posts/{encoded}`,
      requestSummary: { postUrn: urn },
      responseSummary: "GET post then engagement pair (see trace steps)",
    })
    const result = await fetchFromUnipile(urn, trace)
    if (result) {
      if (urn !== preferredUrn) {
        console.log("[Radar] Unipile succeeded with alternate URN", { tried: preferredUrn, worked: urn })
      }
      appendTrace(trace, {
        phase: "unipile",
        title: "Unipile — success",
        service: "internal",
        endpoint: "(local)",
        requestSummary: { winningUrn: urn },
        responseSummary: "Post fetch OK; comments/reactions parsed from same attempt",
      })
      return result
    }
  }
  console.log("[Radar] Unipile: all URN variants failed", { postId, candidatesTried: candidates })
  appendTrace(trace, {
    phase: "unipile",
    title: "Unipile — all URN variants failed",
    service: "unipile",
    endpoint: `${unipileV1Base()}/posts/...`,
    requestSummary: { postId, candidatesTried: candidates },
    responseSummary: "Post GET never returned 200 for any URN",
  })
  return null
}

/**
 * Unipile LinkedIn comments often return author_details with profile_url + headline but no "name"
 * (see OpenAPI Comment schema). Derive a display label from /in/{slug} when possible.
 */
function displayNameFromLinkedInProfileUrl(raw: unknown): string | null {
  if (raw == null || typeof raw !== "string") return null
  const trimmed = raw.trim()
  const m = trimmed.match(/linkedin\.com\/in\/([^/?#]+)/i)
  if (!m?.[1]) return null
  const slug = decodeURIComponent(m[1]).replace(/\/$/, "")
  if (!slug || slug.toLowerCase() === "me") return null
  if (/^urn:li:/i.test(slug)) return null
  if (slug.length > 100 || /^ACoA|^ACw[A-Za-z0-9_-]+$/i.test(slug)) return null
  const words = slug
    .replace(/-\d+$/u, "")
    .split(/[-_]+/u)
    .filter((w) => w.length > 0)
  if (words.length === 0) return null
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
}

/** Extract display name from Unipile-style object (tries name/full_name/first+last/public_identifier). */
function extractName(obj: Record<string, unknown> | null | undefined): string {
  if (!obj || typeof obj !== "object") return "Unknown"
  const name =
    (obj.name as string) ??
    (obj.full_name as string) ??
    (obj.formatted_name as string) ??
    (obj.display_name as string) ??
    (obj.commenter_name as string) ??
    (obj.author_name as string) ??
    (obj.creator_name as string) ??
    (obj.owner_name as string) ??
    (obj.actor_name as string) ??
    (obj.user_name as string) ??
    (obj.from_name as string)
  if (name && String(name).trim()) return String(name).trim()
  const first = (obj.first_name as string) ?? ""
  const last = (obj.last_name as string) ?? ""
  const combined = [first, last].filter(Boolean).join(" ").trim()
  if (combined) return combined
  const pid = (obj.public_identifier as string) ?? (obj.username as string) ?? (obj.slug as string)
  if (pid && String(pid).trim()) return String(pid).trim()
  // created_by / attributed_to might be a string (name) or object
  const createdBy = obj.created_by ?? obj.attributed_to
  if (typeof createdBy === "string" && createdBy.trim()) return createdBy.trim()
  if (createdBy && typeof createdBy === "object" && typeof (createdBy as Record<string, unknown>).name === "string")
    return String((createdBy as Record<string, unknown>).name).trim()
  const fromUrl = displayNameFromLinkedInProfileUrl(obj.profile_url ?? obj.url ?? obj.linkedin_url)
  if (fromUrl) return fromUrl
  return "Unknown"
}

/** Try to get commentator name from comment object top-level keys (Unipile uses author string; others use author_name, etc.). */
function extractCommenterNameFromComment(c: Record<string, unknown>): string | null {
  const keys = [
    "author",
    "commenter_name",
    "author_name",
    "creator_name",
    "display_name",
    "commenter_display_name",
    "commenter_full_name",
    "owner_name",
    "from_name",
    "user_name",
    "commenter",
    "creator",
    "posted_by",
  ]
  for (const key of keys) {
    const v = c[key]
    if (typeof v === "string" && v.trim() && !/^urn:li:/i.test(v.trim())) return v.trim()
    if (v && typeof v === "object" && typeof (v as Record<string, unknown>).name === "string") {
      const n = String((v as Record<string, unknown>).name).trim()
      if (n) return n
    }
  }
  return null
}

/** Fallback label when we have no name: use comment preview or "Commentator N". */
function commentFallbackLabel(c: Record<string, unknown>, index: number): string {
  const text = c.text ?? c.body ?? c.content ?? c.message
  if (typeof text === "string" && text.trim()) {
    const preview = text.trim().slice(0, 40).replace(/\s+/g, " ")
    return preview.length < text.trim().length ? `${preview}…` : preview
  }
  return `Commentator ${index + 1}`
}

/** Extract headline/title from Unipile-style object. */
function extractHeadline(obj: Record<string, unknown> | null | undefined): string | undefined {
  if (!obj || typeof obj !== "object") return undefined
  const v =
    obj.headline ??
    obj.title ??
    obj.job_title ??
    obj.position ??
    obj.subline ??
    obj.occupation
  return v != null && String(v).trim() ? String(v).trim() : undefined
}

/** Extract profile URL from Unipile-style object. */
function extractProfileUrl(obj: Record<string, unknown> | null | undefined): string | undefined {
  if (!obj || typeof obj !== "object") return undefined
  const v = obj.profile_url ?? obj.url ?? obj.linkedin_url ?? obj.public_identifier
  if (v == null || !String(v).trim()) return undefined
  const s = String(v).trim()
  if (s.startsWith("http")) return s
  return `https://www.linkedin.com/in/${s.replace(/^\/+/, "")}`
}

/** Get the "person" object from a comment or reaction item. Unipile comments use author_details; fallback to creator/posted_by/etc. */
function getPersonFromItem(item: Record<string, unknown>, forComment: boolean): Record<string, unknown> {
  const candidates = forComment
    ? [
        item.author_details,
        item.creator,
        item.posted_by,
        item.comment_author,
        item.author,
        item.owner,
        item.commenter,
        item.user,
        item.from,
        item.member,
        item.person,
        item.profile,
        item.commenter_profile,
        item.author_profile,
        item.creator_profile,
        item.actor,
        // Nested: e.g. comment.author or message.sender
        (item.comment as Record<string, unknown> | undefined)?.author,
        (item.comment as Record<string, unknown> | undefined)?.creator,
        (item.message as Record<string, unknown> | undefined)?.sender,
      ]
    : [item.author, item.actor, item.actor_details, item.owner, item.user, item.from]
  for (const c of candidates) {
    if (c && typeof c === "object" && !Array.isArray(c)) return c as Record<string, unknown>
  }
  return item
}

function normalizeUnipileData(
  postData: Record<string, unknown>,
  comments: { items?: unknown[]; data?: unknown[]; comments?: unknown[] },
  reactions: { items?: unknown[]; data?: unknown[]; reactions?: unknown[] }
): NormalizedPostData {
  const items = (x: Record<string, unknown> | null | undefined): unknown[] => {
    if (!x) return []
    const arr = (x.items ?? x.data ?? x.comments ?? x.reactions) as unknown[] | undefined
    return Array.isArray(arr) ? arr : []
  }

  const author = (postData.author as Record<string, unknown>) ?? {}
  const authorName = extractName(author) !== "Unknown" ? extractName(author) : extractName(postData as Record<string, unknown>)
  const authorHeadline = extractHeadline(author) ?? extractHeadline(postData as Record<string, unknown>)

  const toPersonFromComment = (c: Record<string, unknown>, i: number): RadarPerson => {
    const person = getPersonFromItem(c, true)
    // 1) Comment-specific top-level keys (commenter_name, author_name, etc.)
    const fromComment = extractCommenterNameFromComment(c)
    const name =
      (fromComment && fromComment !== "Unknown") ? fromComment
      : extractName(person) !== "Unknown" ? extractName(person)
      : extractName(c) !== "Unknown" ? extractName(c)
      : commentFallbackLabel(c, i)
    const headline = extractHeadline(person) ?? extractHeadline(c)
    const profileUrl = extractProfileUrl(person) ?? extractProfileUrl(c)
    const commentText = c.text ?? c.body ?? c.content ?? c.message
    const commentDate = c.date ?? c.created_at
    return {
      id: String(c.id ?? profileUrl ?? i) || `unipile-comment-${i}`,
      name,
      headline,
      profile_url: profileUrl,
      type: "commentator",
      text: commentText != null ? String(commentText) : undefined,
      date: commentDate != null ? String(commentDate) : undefined,
    }
  }

  const toPersonFromReaction = (r: Record<string, unknown>, i: number): RadarPerson => {
    const person = getPersonFromItem(r, false)
    let name = extractName(person)
    if (name === "Unknown") name = extractName(r)
    if (name === "Unknown") {
      const rt = r.value ?? r.reaction_type
      name = rt != null ? `Member (${String(rt)})` : `Reactioner ${i + 1}`
    }
    return {
      id: String(r.id ?? extractProfileUrl(person) ?? i) || `unipile-reaction-${i}`,
      name,
      headline: extractHeadline(person),
      profile_url: extractProfileUrl(person),
      type: "reactioner",
      reaction_type:
        r.reaction_type != null
          ? String(r.reaction_type)
          : r.value != null
            ? String(r.value)
            : undefined,
    }
  }

  const commentList = items(comments as Record<string, unknown>)
  const reactionList = items(reactions as Record<string, unknown>)
  const commentators = commentList.map((c, i) => toPersonFromComment((c ?? {}) as Record<string, unknown>, i))
  const reactioners = reactionList.map((r, i) => toPersonFromReaction((r ?? {}) as Record<string, unknown>, i))

  console.log("[Radar] Step 3: Normalized commentators & reactioners", {
    commentatorsCount: commentators.length,
    reactionersCount: reactioners.length,
    commentatorsWithProfileUrl: commentators.filter((p) => (p.profile_url ?? "").trim()).length,
    reactionersWithProfileUrl: reactioners.filter((p) => (p.profile_url ?? "").trim()).length,
  })

  const counters = (postData.counters as Record<string, unknown>) ?? {}
  const reactionsCount = Number(counters.reactions ?? counters.likes ?? reactioners.length) || reactioners.length
  const commentsCount = Number(counters.comments ?? commentators.length) || commentators.length

  return {
    content: String(postData.text ?? postData.content ?? ""),
    reactionsCount,
    commentsCount,
    postUrl: String(postData.share_url ?? postData.url ?? ""),
    linkedinPostId: postData.id != null ? String(postData.id) : null,
    createdAt: postData.created_at != null ? String(postData.created_at) : null,
    authorName,
    authorHeadline,
    commentators,
    reactioners,
  }
}

export type RadarExecuteResult =
  | { ok: true; result: RadarResult }
  | { ok: false; status: number; error: string }

/**
 * Shared resolver for `/api/radar` and `/api/radar/logging`.
 * When `trace` is passed, append-only steps are recorded (no API keys).
 */
export async function executeRadarPost(url: string, trace?: RadarTraceStep[]): Promise<RadarExecuteResult> {
  const trimmed = url.trim()
  appendTrace(trace, {
    phase: "request",
    title: "Incoming JSON body",
    service: "internal",
    endpoint: "POST body: { url }",
    requestSummary: { payload: { url: trimmed || "(empty)" } },
    responseSummary: "parsed",
  })

  console.log("[Radar] POST start", { url: trimmed ? `${trimmed.slice(0, 60)}...` : "(empty)" })
  if (!trimmed) {
    return { ok: false, status: 400, error: "Post URL is required" }
  }
  if (!trimmed.includes("linkedin.com")) {
    return { ok: false, status: 400, error: "Invalid LinkedIn URL" }
  }

  const postRef = extractPostRef(trimmed)
  console.log("[Radar] Extracted post ref", { postRef })
  appendTrace(trace, {
    phase: "parse",
    title: "LinkedIn URL → post id + preferred URN",
    service: "internal",
    endpoint: "(local extractPostRef)",
    requestSummary: { inputUrl: trimmed },
    responseSummary: postRef
      ? JSON.stringify({ postId: postRef.postId, preferredUrn: postRef.urn })
      : "Could not extract post id",
  })
  if (!postRef) {
    return {
      ok: false,
      status: 400,
      error: "Could not extract post ID from URL. Use a direct LinkedIn post link.",
    }
  }
  const { postId, urn: postUrn } = postRef

  let postData: NormalizedPostData
  let source: "supabase" | "unipile" = "supabase"

  const supabaseRow = await searchSupabase(postId, trace)
  if (supabaseRow) {
    console.log("[Radar] Using Supabase data (skip Unipile)")
    appendTrace(trace, {
      phase: "result",
      title: "Using Supabase row (Unipile not called for post/comments/reactions)",
      service: "internal",
      endpoint: "(local)",
      requestSummary: { source: "supabase" },
      responseSummary: "Normalized commentators/reactioners from stored JSON",
    })
    postData = normalizeSupabaseData(supabaseRow)
  } else {
    const unipile = await fetchFromUnipileWithFallback(postId, postUrn, trace)
    if (!unipile) {
      return {
        ok: false,
        status: 404,
        error:
          "Post not found in Supabase and Unipile is not configured or returned no data. Set UNIPILE_API_KEY and UNIPILE_ACCOUNT_ID for fallback.",
      }
    }
    source = "unipile"
    postData = normalizeUnipileData(
      unipile.postData as Record<string, unknown>,
      unipile.comments,
      unipile.reactions
    )
    const rawComments = Array.isArray((unipile.comments as { items?: unknown[] }).items)
      ? (unipile.comments as { items: Record<string, unknown>[] }).items
      : ([] as Record<string, unknown>[])
    const rawReactions = Array.isArray((unipile.reactions as { items?: unknown[] }).items)
      ? (unipile.reactions as { items: Record<string, unknown>[] }).items
      : ([] as Record<string, unknown>[])
    const missingCommentators = postData.commentators.filter((p) => !(p.profile_url ?? "").trim()).length
    const missingReactioners = postData.reactioners.filter((p) => !(p.profile_url ?? "").trim()).length
    console.log("[Radar] Step 4: Before enrichment", {
      missingProfileUrlCommentators: missingCommentators,
      missingProfileUrlReactioners: missingReactioners,
    })
    await enrichWithUnipileProfiles(
      postData.commentators,
      postData.reactioners,
      rawComments,
      rawReactions
    )
    appendTrace(trace, {
      phase: "unipile",
      title: "Profile enrichment (optional)",
      service: "unipile",
      httpMethod: "GET",
      endpoint: `${unipileV1Base()}/users/{identifier}?account_id=*`,
      requestSummary: {
        note: "Sequential GET /users/{id} for people missing profile_url after normalize",
        rowsMissingUrlBefore: {
          commentators: missingCommentators,
          reactioners: missingReactioners,
        },
      },
      responseSummary: "Completed (see server logs for per-user calls)",
    })
    const afterCommentatorsWithUrl = postData.commentators.filter((p) => (p.profile_url ?? "").trim()).length
    const afterReactionersWithUrl = postData.reactioners.filter((p) => (p.profile_url ?? "").trim()).length
    console.log("[Radar] Step 5: After enrichment", {
      commentatorsWithProfileUrl: afterCommentatorsWithUrl,
      reactionersWithProfileUrl: afterReactionersWithUrl,
    })
  }

  if (!postData.postUrl && trimmed) postData.postUrl = trimmed

  const combinedCount = (postData.commentators?.length ?? 0) + (postData.reactioners?.length ?? 0)
  console.log("[Radar] Step 6: Final result", {
    source,
    commentatorsCount: postData.commentators?.length ?? 0,
    reactionersCount: postData.reactioners?.length ?? 0,
    combinedLeadsCount: combinedCount,
  })

  appendTrace(trace, {
    phase: "result",
    title: "Final normalized payload (returned to client)",
    service: "internal",
    endpoint: "(response JSON)",
    requestSummary: {
      source,
      commentatorsCount: postData.commentators?.length ?? 0,
      reactionersCount: postData.reactioners?.length ?? 0,
    },
    responseSummary: "OK",
  })

  return { ok: true, result: { postData, source } }
}

/** POST: body { url: string }. Returns normalized postData + source (supabase | unipile). */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const url = typeof body.url === "string" ? body.url.trim() : ""
    const out = await executeRadarPost(url)
    if (!out.ok) {
      return NextResponse.json({ error: out.error }, { status: out.status })
    }
    return NextResponse.json(out.result)
  } catch (err) {
    console.error("Radar API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    )
  }
}
