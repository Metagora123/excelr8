import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { getUnipileApiKey, getUnipileAccountId } from "@/lib/env"

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

const UNIPILE_BASE = "https://api17.unipile.com:14713/api/v1"

/** Unipile docs: GET /users/{identifier} - identifier can be public_identifier (slug) or provider_id. */
async function fetchUnipileUserProfile(identifier: string): Promise<{
  profile_url: string
  headline?: string
} | null> {
  const apiKey = getUnipileApiKey()
  const accountId = getUnipileAccountId()
  if (!apiKey || !accountId) return null
  const encoded = encodeURIComponent(identifier)
  const url = `${UNIPILE_BASE}/users/${encoded}?account_id=${accountId}`
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
      : [item.actor, item.owner, item.author, item.user, item.from]
    for (const c of candidates) {
      if (c && typeof c === "object") return c as Record<string, unknown>
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

function extractPostId(url: string): string | null {
  const patterns = [
    /urn:li:activity:(\d+)/i,
    /urn:li:ugcPost:(\d+)/i,
    /activity-(\d+)/i,
    /ugcPost-(\d+)/i,
    /\/posts\/[^/]*activity-(\d+)/i,
    /\/posts\/[^/]*ugcPost-(\d+)/i,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

async function searchSupabase(postId: string): Promise<Record<string, unknown> | null> {
  try {
    const supabase = getSupabase()
    const activityUrn = `urn:li:activity:${postId}`
    const ugcUrn = `urn:li:ugcPost:${postId}`

    const attempts = [
      supabase.from("lead_posts").select("*").eq("linkedin_post_id", activityUrn).maybeSingle(),
      supabase.from("lead_posts").select("*").eq("linkedin_post_id", ugcUrn).maybeSingle(),
      supabase.from("lead_posts").select("*").ilike("post_url", `%activity-${postId}%`).maybeSingle(),
      supabase.from("lead_posts").select("*").ilike("post_url", `%ugcPost-${postId}%`).maybeSingle(),
    ]

    for (const q of attempts) {
      const { data, error } = await q
      if (!error && data) return data as Record<string, unknown>
    }
  } catch {
    // Table may not exist or RLS may block
  }
  return null
}

function normalizeSupabaseData(row: Record<string, unknown>): NormalizedPostData {
  const commentators = (row.commentators as Record<string, unknown>[] | undefined) ?? []
  const reactioners = (row.reactioners as Record<string, unknown>[] | undefined) ?? []

  const toPerson = (p: Record<string, unknown>, i: number, type: "commentator" | "reactioner"): RadarPerson => ({
    id: String((p.id ?? p.profile_url ?? i) ?? `supabase-${type}-${i}`),
    name: String(p.name ?? p.lead_name ?? "Unknown"),
    headline: p.headline != null ? String(p.headline) : undefined,
    profile_url: p.profile_url != null ? String(p.profile_url) : undefined,
    type,
    text: p.text != null ? String(p.text) : undefined,
    date: p.date != null ? String(p.date) : undefined,
    reaction_type: p.reaction_type != null ? String(p.reaction_type) : undefined,
  })

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

async function fetchFromUnipile(postId: string): Promise<{
  postData: unknown
  comments: { items?: unknown[] }
  reactions: { items?: unknown[] }
} | null> {
  const apiKey = getUnipileApiKey()
  const accountId = getUnipileAccountId()
  if (!apiKey || !accountId) return null

  const urn = `urn:li:activity:${postId}`
  const encodedUrn = encodeURIComponent(urn)
  const baseUrl = `${UNIPILE_BASE}/posts/${encodedUrn}`
  const params = new URLSearchParams({ account_id: accountId })
  const headers: Record<string, string> = {
    "X-API-KEY": apiKey,
    accept: "application/json",
  }

  console.log("[Radar] Step 1: Fetching from Unipile", { postId, urn, account_id: accountId })

  const [postRes, commentsRes, reactionsRes] = await Promise.all([
    fetch(`${baseUrl}?${params}`, { headers }),
    fetch(`${baseUrl}/comments?${params}`, { headers }),
    fetch(`${baseUrl}/reactions?${params}`, { headers }),
  ])

  if (!postRes.ok) {
    console.log("[Radar] Step 1 failed: post fetch not ok", { status: postRes.status })
    return null
  }
  const postData = await postRes.json()
  const comments = commentsRes.ok ? await commentsRes.json() : { items: [] }
  const reactions = reactionsRes.ok ? await reactionsRes.json() : { items: [] }

  const commentsCount = Array.isArray(comments.items) ? comments.items.length : 0
  const reactionsCount = Array.isArray(reactions.items) ? reactions.items.length : 0
  console.log("[Radar] Step 2: Unipile responses received", {
    commentsCount,
    reactionsCount,
    commentsItems: comments.items != null ? "present" : "missing",
    reactionsItems: reactions.items != null ? "present" : "missing",
  })

  return { postData, comments, reactions }
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
    if (typeof v === "string" && v.trim()) return v.trim()
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
    : [item.actor, item.actor_details, item.owner, item.author, item.user, item.from]
  for (const c of candidates) {
    if (c && typeof c === "object") return c as Record<string, unknown>
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
    return {
      id: String(c.id ?? profileUrl ?? i) || `unipile-comment-${i}`,
      name,
      headline,
      profile_url: profileUrl,
      type: "commentator",
      text: c.text != null ? String(c.text) : undefined,
      date: c.created_at != null ? String(c.created_at) : undefined,
    }
  }

  const toPersonFromReaction = (r: Record<string, unknown>, i: number): RadarPerson => {
    const person = getPersonFromItem(r, false)
    const name = extractName(person)
    return {
      id: String(r.id ?? extractProfileUrl(person) ?? i) || `unipile-reaction-${i}`,
      name,
      headline: extractHeadline(person),
      profile_url: extractProfileUrl(person),
      type: "reactioner",
      reaction_type: r.reaction_type != null ? String(r.reaction_type) : undefined,
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

/** POST: body { url: string }. Returns normalized postData + source (supabase | unipile). */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const url = typeof body.url === "string" ? body.url.trim() : ""
    console.log("[Radar] POST start", { url: url ? `${url.slice(0, 60)}...` : "(empty)" })
    if (!url) {
      return NextResponse.json({ error: "Post URL is required" }, { status: 400 })
    }
    if (!url.includes("linkedin.com")) {
      return NextResponse.json({ error: "Invalid LinkedIn URL" }, { status: 400 })
    }

    const postId = extractPostId(url)
    console.log("[Radar] Extracted postId", { postId })
    if (!postId) {
      return NextResponse.json(
        { error: "Could not extract post ID from URL. Use a direct LinkedIn post link." },
        { status: 400 }
      )
    }

    let postData: NormalizedPostData
    let source: "supabase" | "unipile" = "supabase"

    const supabaseRow = await searchSupabase(postId)
    if (supabaseRow) {
      console.log("[Radar] Using Supabase data (skip Unipile)")
      postData = normalizeSupabaseData(supabaseRow)
    } else {
      const unipile = await fetchFromUnipile(postId)
      if (!unipile) {
        return NextResponse.json(
          {
            error:
              "Post not found in Supabase and Unipile is not configured or returned no data. Set UNIPILE_API_KEY and UNIPILE_ACCOUNT_ID for fallback.",
          },
          { status: 404 }
        )
      }
      source = "unipile"
      postData = normalizeUnipileData(
        unipile.postData as Record<string, unknown>,
        unipile.comments,
        unipile.reactions
      )
      const rawComments = Array.isArray((unipile.comments as { items?: unknown[] }).items)
        ? ((unipile.comments as { items: Record<string, unknown>[] }).items)
        : [] as Record<string, unknown>[]
      const rawReactions = Array.isArray((unipile.reactions as { items?: unknown[] }).items)
        ? ((unipile.reactions as { items: Record<string, unknown>[] }).items)
        : [] as Record<string, unknown>[]
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
      const afterCommentatorsWithUrl = postData.commentators.filter((p) => (p.profile_url ?? "").trim()).length
      const afterReactionersWithUrl = postData.reactioners.filter((p) => (p.profile_url ?? "").trim()).length
      console.log("[Radar] Step 5: After enrichment", {
        commentatorsWithProfileUrl: afterCommentatorsWithUrl,
        reactionersWithProfileUrl: afterReactionersWithUrl,
      })
    }

    // Ensure postUrl is set if we only had postId
    if (!postData.postUrl && url) postData.postUrl = url

    const combinedCount = (postData.commentators?.length ?? 0) + (postData.reactioners?.length ?? 0)
    console.log("[Radar] Step 6: Final result", {
      source,
      commentatorsCount: postData.commentators?.length ?? 0,
      reactionersCount: postData.reactioners?.length ?? 0,
      combinedLeadsCount: combinedCount,
    })

    const result: RadarResult = { postData, source }
    return NextResponse.json(result)
  } catch (err) {
    console.error("Radar API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    )
  }
}
