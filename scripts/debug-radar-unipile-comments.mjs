#!/usr/bin/env node
/**
 * Calls the same Unipile endpoints as Post Radar (GET post + comments + reactions)
 * and prints the shape of the first comment/reaction so you can see why names were "Unknown".
 *
 * Requires: UNIPILE_API_KEY, UNIPILE_ACCOUNT_ID in env.
 * Usage (Node 20+):
 *   node --env-file=.env scripts/debug-radar-unipile-comments.mjs "https://www.linkedin.com/feed/update/urn:li:activity:..."
 *
 * Optional: UNIPILE_API_BASE=https://api17.unipile.com:14713
 */

function extractPostRef(url) {
  const mActivityUrn = url.match(/urn:li:activity:(\d+)/i)
  if (mActivityUrn?.[1]) return { urn: `urn:li:activity:${mActivityUrn[1]}` }
  const mUgcUrn = url.match(/urn:li:ugcPost:(\d+)/i)
  if (mUgcUrn?.[1]) return { urn: `urn:li:ugcPost:${mUgcUrn[1]}` }
  const mShareUrn = url.match(/urn:li:share:(\d+)/i)
  if (mShareUrn?.[1]) return { urn: `urn:li:share:${mShareUrn[1]}` }
  const mUgcSlug = url.match(/ugcPost-(\d+)/i)
  if (mUgcSlug?.[1]) return { urn: `urn:li:ugcPost:${mUgcSlug[1]}` }
  const mShareSlug = url.match(/share-(\d+)/i)
  if (mShareSlug?.[1]) return { urn: `urn:li:share:${mShareSlug[1]}` }
  const mActivitySlug = url.match(/activity-(\d+)/i)
  if (mActivitySlug?.[1]) return { urn: `urn:li:activity:${mActivitySlug[1]}` }
  const mPostsActivity = url.match(/\/posts\/[^/]*activity-(\d+)/i)
  if (mPostsActivity?.[1]) return { urn: `urn:li:activity:${mPostsActivity[1]}` }
  const mPostsUgc = url.match(/\/posts\/[^/]*ugcPost-(\d+)/i)
  if (mPostsUgc?.[1]) return { urn: `urn:li:ugcPost:${mPostsUgc[1]}` }
  const mPostsShare = url.match(/\/posts\/[^/]*share-(\d+)/i)
  if (mPostsShare?.[1]) return { urn: `urn:li:share:${mPostsShare[1]}` }
  return null
}

function summarizeKeys(obj, max = 30) {
  if (obj == null || typeof obj !== "object") return "(not an object)"
  return Object.keys(obj).slice(0, max).join(", ")
}

async function main() {
  const url = process.argv[2]
  if (!url) {
    console.error('Usage: node scripts/debug-radar-unipile-comments.mjs "<linkedin post url>"')
    process.exitCode = 1
    return
  }
  const apiKey = process.env.UNIPILE_API_KEY ?? process.env.VITE_UNIPILE_API_KEY
  const accountId = process.env.UNIPILE_ACCOUNT_ID ?? process.env.VITE_UNIPILE_ACCOUNT_ID
  const base = (process.env.UNIPILE_API_BASE ?? "https://api17.unipile.com:14713").replace(/\/$/, "")
  if (!apiKey || !accountId) {
    console.error("Missing UNIPILE_API_KEY or UNIPILE_ACCOUNT_ID (try: node --env-file=.env ...)")
    process.exitCode = 1
    return
  }
  const ref = extractPostRef(url)
  if (!ref) {
    console.error("Could not extract post URN from URL")
    process.exitCode = 1
    return
  }
  const postUrn = ref.urn
  const encoded = encodeURIComponent(postUrn)
  const params = new URLSearchParams({ account_id: accountId })
  const headers = { "X-API-KEY": apiKey, accept: "application/json" }
  const root = `${base}/api/v1/posts/${encoded}`

  console.log("Post URN:", postUrn)
  const [postRes, commentsRes, reactionsRes] = await Promise.all([
    fetch(`${root}?${params}`, { headers }),
    fetch(`${root}/comments?${params}`, { headers }),
    fetch(`${root}/reactions?${params}`, { headers }),
  ])
  console.log("GET post:", postRes.status, "comments:", commentsRes.status, "reactions:", reactionsRes.status)
  if (!postRes.ok) {
    console.error(await postRes.text().catch(() => ""))
    process.exitCode = 1
    return
  }
  const comments = commentsRes.ok ? await commentsRes.json() : {}
  const reactions = reactionsRes.ok ? await reactionsRes.json() : {}
  const cItems = Array.isArray(comments.items) ? comments.items : []
  const rItems = Array.isArray(reactions.items) ? reactions.items : []
  console.log("\n--- First comment (raw) ---")
  const c0 = cItems[0]
  if (!c0) console.log("(no comments)")
  else {
    console.log("Top-level keys:", summarizeKeys(c0))
    console.log("typeof author:", typeof c0.author, "author sample:", typeof c0.author === "string" ? c0.author.slice(0, 80) : summarizeKeys(c0.author))
    const ad = c0.author_details
    console.log("author_details keys:", summarizeKeys(ad))
    if (ad && typeof ad === "object") {
      console.log("author_details.name present:", "name" in ad && ad.name != null)
      console.log("author_details.profile_url:", typeof ad.profile_url === "string" ? ad.profile_url.slice(0, 80) : ad.profile_url)
      console.log("author_details.headline:", typeof ad.headline === "string" ? ad.headline.slice(0, 80) : ad.headline)
    }
    console.log("text field:", typeof c0.text === "string" ? c0.text.slice(0, 60) : c0.text)
  }
  console.log("\n--- First reaction (raw) ---")
  const r0 = rItems[0]
  if (!r0) console.log("(no reactions)")
  else {
    console.log("Top-level keys:", summarizeKeys(r0))
    const a = r0.author
    console.log("author keys:", summarizeKeys(a))
    if (a && typeof a === "object") {
      console.log("author.name:", a.name)
      console.log("author.profile_url:", typeof a.profile_url === "string" ? a.profile_url.slice(0, 80) : a.profile_url)
    }
    console.log("value (reaction type):", r0.value, "reaction_type:", r0.reaction_type)
  }
  console.log("\n(Unipile LinkedIn Comment schema often has author_details without a `name` field; use profile_url slug.)")
}

main()
