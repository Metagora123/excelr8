/**
 * Client-safe CSV helpers (no server imports) for capping how many rows get
 * uploaded/processed. Mirrors the logical-row splitting used by the in-app
 * parser so quoted fields with embedded newlines are not split mid-record.
 */

import type { CsvRowSelection } from "@/lib/csv-row-selection"

/** Vercel serverless request body limit (~4.5MB); stay under for safety margin. */
export const VERCEL_UPLOAD_LIMIT_BYTES = 4_000_000

/** Split CSV text into logical rows, honoring quoted fields with embedded newlines. */
function splitCsvIntoLogicalRows(csvText: string): string[] {
  const rows: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i]
    if (c === '"') {
      const next = csvText[i + 1]
      if (inQuotes && next === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
        cur += c
      }
    } else if ((c === "\n" || (c === "\r" && csvText[i + 1] === "\n")) && !inQuotes) {
      if (c === "\r") i++
      rows.push(cur)
      cur = ""
    } else if (c !== "\r" || inQuotes) {
      cur += c
    }
  }
  if (cur.length > 0) rows.push(cur)
  return rows
}

/**
 * Truncate a CSV File to the first `limit` data rows (the header row is always
 * kept). A non-finite or non-positive `limit` returns the original file. If the
 * file already has fewer data rows than `limit`, the original file is returned.
 */
export async function truncateCsvFile(file: File, limit: number): Promise<File> {
  if (!Number.isFinite(limit) || limit <= 0) return file
  const text = await file.text()
  const rows = splitCsvIntoLogicalRows(text)
  // rows[0] is the header; keep header + first `limit` data rows.
  if (rows.length <= limit + 1) return file
  const truncated = rows.slice(0, limit + 1).join("\n")
  return new File([truncated], file.name, { type: file.type || "text/csv" })
}

/** Resolve a preview-limit select value ("10" | "all" | ...) to a numeric cap (Infinity for "all"). */
export function resolveRowLimit(value: string): number {
  if (value === "all") return Infinity
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : Infinity
}

/** Return the first N rows from an in-memory list (no cap when limit is "all"). */
export function sliceRows<T>(rows: T[], limitValue: string): T[] {
  const limit = resolveRowLimit(limitValue)
  if (!Number.isFinite(limit)) return rows
  return rows.slice(0, limit)
}

/**
 * Build a CSV File for upload: selected rows minus exclusions.
 * Exclusions are 0-based indices within the selected slice.
 */
export async function buildUploadCsvFile(
  file: File,
  selection: CsvRowSelection | string,
  excludeIndices: number[] = []
): Promise<File> {
  const sel: CsvRowSelection =
    typeof selection === "string" ? { kind: "first", count: selection } : selection

  const text = await file.text()
  const rows = splitCsvIntoLogicalRows(text).filter((l) => l.trim())
  if (rows.length < 2) return file

  const header = rows[0]
  let dataRows = rows.slice(1)

  if (sel.kind === "range") {
    const start = Math.max(1, sel.start)
    const end = Math.max(start, sel.end)
    dataRows = dataRows.slice(start - 1, end)
  } else {
    const limit = resolveRowLimit(sel.count)
    if (Number.isFinite(limit)) {
      dataRows = dataRows.slice(0, limit)
    }
  }

  if (excludeIndices.length > 0) {
    const exclude = new Set(excludeIndices)
    dataRows = dataRows.filter((_, i) => !exclude.has(i))
  }
  if (dataRows.length === 0) {
    return new File([header], file.name, { type: file.type || "text/csv" })
  }
  return new File([[header, ...dataRows].join("\n")], file.name, { type: file.type || "text/csv" })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Count data rows in a CSV (excludes header). */
export async function countCsvDataRows(file: File): Promise<number> {
  const text = await file.text()
  const rows = splitCsvIntoLogicalRows(text).filter((l) => l.trim())
  return Math.max(0, rows.length - 1)
}

/** Block "All rows" preview when the raw file exceeds the hosted upload limit. */
export function isAllRowsPreviewBlocked(file: File | null): boolean {
  return file != null && file.size > VERCEL_UPLOAD_LIMIT_BYTES
}
