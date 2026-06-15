import { formatBytes, VERCEL_UPLOAD_LIMIT_BYTES } from "@/lib/csv-truncate"

/** Map preview API / fetch failures to operator-friendly messages (with codes for support). */
export function formatPreviewError(
  status: number,
  data?: { error?: string; code?: string } | null,
  opts?: { preflightAll?: boolean; uploadBytes?: number }
): string {
  if (opts?.preflightAll) {
    return (
      `PREVIEW_TOO_LARGE: Full-file preview is not available for files over ${formatBytes(VERCEL_UPLOAD_LIMIT_BYTES)} on hosted deploy. ` +
      "Choose 50–200 rows instead, or split the CSV."
    )
  }
  if (opts?.uploadBytes != null && opts.uploadBytes > VERCEL_UPLOAD_LIMIT_BYTES) {
    return (
      `PREVIEW_TOO_LARGE: This slice is ${formatBytes(opts.uploadBytes)} (limit ~${formatBytes(VERCEL_UPLOAD_LIMIT_BYTES)}). ` +
      "Try fewer rows (50 or 100) or split the CSV."
    )
  }

  const serverMsg = data?.error?.trim()
  const code = data?.code?.trim()

  switch (status) {
    case 413:
      return (
        "PREVIEW_413: File too large for hosted preview (Vercel ~4.5MB limit). " +
        "Choose fewer rows (50/100/200) or split the CSV."
      )
    case 504:
      return "PREVIEW_504: Preview timed out. Try 50 rows first, then increase if needed."
    case 401:
    case 403:
      return "PREVIEW_AUTH: Server could not reach Supabase. Check env vars on Vercel (service role key for the selected project)."
    case 500:
      return serverMsg
        ? `PREVIEW_500: ${serverMsg}`
        : "PREVIEW_500: Server error while parsing CSV. Check Vercel logs."
    case 400:
      return serverMsg ? `PREVIEW_400: ${serverMsg}` : "PREVIEW_400: Invalid request (missing or empty CSV)."
    default:
      if (status === 0) return "PREVIEW_NETWORK: Network error — check your connection and try again."
      if (serverMsg) return code ? `${code}: ${serverMsg}` : serverMsg
      return `PREVIEW_${status}: Preview failed (${status}).`
  }
}
