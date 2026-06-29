export type InlineStreamErrorContext = {
  error?: unknown
  httpStatus?: number
  enrichmentProgress?: { done: number; total: number; currentLead?: string | null } | null
  lastCheckpoint?: string | null
  streamCompleted?: boolean
  streamEndedEarly?: boolean
}

export type InlineStreamErrorDetail = {
  code: string
  title: string
  summary: string
  why: string
  howToFix: string[]
  technical: string
}

function isNetworkLikeError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("network") ||
    m.includes("failed to fetch") ||
    m.includes("load failed") ||
    m.includes("networkerror") ||
    m.includes("aborted") ||
    m.includes("connection")
  )
}

export function formatInlineStreamError(ctx: InlineStreamErrorContext): InlineStreamErrorDetail {
  const prog = ctx.enrichmentProgress
  const atEnrichment =
    prog != null &&
    prog.total > 0 &&
    (ctx.lastCheckpoint === "lead_campaigns_filled" ||
      ctx.lastCheckpoint === "leads_enriched" ||
      prog.done < prog.total)

  const raw =
    ctx.error instanceof Error
      ? ctx.error.message
      : ctx.error != null
        ? String(ctx.error)
        : ""

  if (ctx.streamEndedEarly || (atEnrichment && !ctx.streamCompleted && !raw)) {
    const done = prog?.done ?? 0
    const total = prog?.total ?? 0
    const current = prog?.currentLead
    return {
      code: "INLINE_STREAM_INTERRUPTED",
      title: "Create campaign stopped mid-run",
      summary: `The server connection closed during enrichment (${done}/${total} leads completed${current ? `, last: ${current}` : ""}).`,
      why:
        "The in-app create runs on Vercel serverless with a ~5 minute limit. Enrichment calls Unipile per lead (~10–30s each). If the function times out, the browser loses the stream, or the network drops, you see a generic network error even though some leads may already be saved.",
      howToFix: [
        `Reduce batch size — upload ${Math.max(5, Math.min(15, total || 15))} leads or fewer per run (use row range, e.g. 1–15 then 16–30).`,
        "Check Vercel → Project → Logs for the same timestamp (look for FUNCTION_INVOCATION_TIMEOUT).",
        "Verify UNIPILE_API_KEY and UNIPILE_ACCOUNT_ID in Vercel env — slow/failed Unipile calls extend runtime.",
        "If enrichment already partially completed, check Supabase — campaign + leads may exist; continue with a new CSV slice instead of re-uploading all rows.",
        "Retry on a stable network; avoid closing the tab while enrichment is running.",
      ],
      technical: `lastCheckpoint=${ctx.lastCheckpoint ?? "unknown"}; enrichment=${done}/${total}; streamCompleted=${Boolean(ctx.streamCompleted)}`,
    }
  }

  if (ctx.httpStatus === 504 || raw.toLowerCase().includes("timeout")) {
    return {
      code: "INLINE_504",
      title: "Server timed out",
      summary: atEnrichment
        ? `Vercel timed out during enrichment (${prog?.done ?? "?"}/${prog?.total ?? "?"} leads).`
        : "The server took too long and Vercel ended the request.",
      why: "In-app create + Unipile enrichment exceeds the serverless time budget (~300s on Pro). Large CSVs or slow Unipile responses trigger this.",
      howToFix: [
        "Upload fewer leads per run (10–15 with row range).",
        "Split the CSV into multiple campaigns.",
        "Check Vercel logs for FUNCTION_INVOCATION_TIMEOUT.",
      ],
      technical: raw || `HTTP ${ctx.httpStatus}`,
    }
  }

  if (raw && isNetworkLikeError(raw)) {
    return {
      code: "INLINE_NETWORK",
      title: "Network error during create",
      summary: atEnrichment
        ? `Browser lost connection to the server while enriching lead ${(prog?.done ?? 0) + 1} of ${prog?.total ?? "?"}.`
        : "Could not maintain connection to the dashboard API.",
      why:
        "This usually means the fetch stream was cut off — Vercel function timeout, proxy idle timeout, Wi‑Fi blip, or tab sleep — not necessarily that Unipile failed on a single lead.",
      howToFix: [
        "Check Supabase: campaign and partial leads may already exist from completed enrichment steps.",
        "Retry with a smaller row range (e.g. rows 12–25 only, if 1–11 succeeded).",
        "Open DevTools → Network → inline request: note status (504, (failed), cancelled).",
        "Check Vercel function logs at the failure time.",
        "Keep the tab focused until enrichment finishes.",
      ],
      technical: raw,
    }
  }

  if (raw) {
    return {
      code: "INLINE_ERROR",
      title: "Create campaign failed",
      summary: raw,
      why: ctx.lastCheckpoint
        ? `Failed after checkpoint "${ctx.lastCheckpoint.replace(/_/g, " ")}".`
        : "The server returned an error during the in-app create flow.",
      howToFix: [
        "Expand enrichment logs below if present.",
        "Check Vercel logs for the full stack trace.",
        "Verify Supabase, Airtable, and Unipile env vars on Vercel.",
      ],
      technical: ctx.httpStatus ? `${raw} (HTTP ${ctx.httpStatus})` : raw,
    }
  }

  return {
    code: "INLINE_UNKNOWN",
    title: "Create campaign failed",
    summary: "An unknown error occurred.",
    why: "No error message was returned from the server stream.",
    howToFix: ["Check Vercel logs.", "Retry with fewer leads."],
    technical: "empty error",
  }
}

export function inlineErrorToDisplayText(detail: InlineStreamErrorDetail): string {
  return `${detail.code}: ${detail.summary}`
}
