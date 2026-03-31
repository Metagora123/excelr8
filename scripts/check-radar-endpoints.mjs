#!/usr/bin/env node
/**
 * Health check for Post Radar: validates LinkedIn URL → URN extraction (matches app/api/radar/route.ts)
 * and POSTs /api/radar for each sample URL. Expect 200 when Supabase has the row or Unipile is configured.
 *
 * Usage:
 *   npm run dev
 *   npm run check:radar
 *
 * Optional: RADAR_TEST_BASE=http://127.0.0.1:3001 node scripts/check-radar-endpoints.mjs
 */

const DEFAULT_SAMPLES = [
  {
    label: "feed activity URN",
    url: "https://www.linkedin.com/feed/update/urn:li:activity:7441843489635454976/?utm_source=share&utm_medium=member_desktop",
  },
  {
    label: "posts slug ugcPost",
    url: "https://www.linkedin.com/posts/moekatib_today-were-killing-2000-integration-companies-ugcPost-7442981140598206464-V9lp?utm_source=share&utm_medium=member_desktop",
  },
  {
    label: "posts slug share",
    url: "https://www.linkedin.com/posts/the-pentagon-has-been-blocked-by-a-us-court-share-7443086517859794944-033n?utm_source=share&utm_medium=member_desktop",
  },
]

/** Keep in sync with extractPostRef() in app/api/radar/route.ts */
function extractPostRef(url) {
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

async function main() {
  const base = (process.env.RADAR_TEST_BASE || "http://127.0.0.1:3000").replace(/\/$/, "")
  const radarUrl = `${base}/api/radar`

  console.log("--- extractPostRef (local, must not be null for known samples) ---\n")
  for (const s of DEFAULT_SAMPLES) {
    const ref = extractPostRef(s.url)
    console.log(`${s.label}:`, ref ? JSON.stringify(ref) : "FAIL null")
  }

  console.log("\n--- POST /api/radar ---\n")
  let okDataCount = 0
  let badRequestCount = 0
  for (const s of DEFAULT_SAMPLES) {
    try {
      const res = await fetch(radarUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: s.url }),
      })
      const body = await res.json().catch(() => ({}))
      const success = res.ok && body.postData
      if (success) okDataCount++
      if (res.status === 400) badRequestCount++
      console.log(
        `${s.label}: HTTP ${res.status}${success ? " OK" : ""}`,
        !success && body.error ? `— ${body.error}` : ""
      )
    } catch (e) {
      console.log(`${s.label}: FETCH ERROR —`, e instanceof Error ? e.message : e)
    }
  }

  const strict = process.env.RADAR_TEST_STRICT === "1"
  console.log(
    `\nSummary: ${okDataCount}/${DEFAULT_SAMPLES.length} returned 2xx with postData. ` +
      "400 = URL/URN handling bug; 404 = not in Supabase or Unipile not configured / post not found upstream."
  )
  if (strict) {
    process.exitCode = okDataCount === DEFAULT_SAMPLES.length ? 0 : 1
  } else {
    process.exitCode = badRequestCount > 0 ? 1 : 0
  }
  if (strict && okDataCount < DEFAULT_SAMPLES.length) {
    console.log("RADAR_TEST_STRICT=1 requires all 200 + postData (needs Supabase row or UNIPILE_* env).")
  }
}

main()
