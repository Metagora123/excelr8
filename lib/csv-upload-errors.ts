import { formatBytes, VERCEL_UPLOAD_LIMIT_BYTES } from "@/lib/csv-truncate"

export type CsvUploadTooLargeContext = {
  preflightAll?: boolean
  uploadBytes?: number
  fileBytes?: number
}

/** User-facing title + body for the file-too-large popup. */
export function getCsvTooLargeDialogContent(ctx: CsvUploadTooLargeContext): {
  title: string
  description: string
} {
  const limit = formatBytes(VERCEL_UPLOAD_LIMIT_BYTES)

  if (ctx.preflightAll || (ctx.fileBytes != null && ctx.fileBytes > VERCEL_UPLOAD_LIMIT_BYTES)) {
    const size = ctx.fileBytes != null ? formatBytes(ctx.fileBytes) : "this file"
    return {
      title: "CSV file too large",
      description: `${size} exceeds the ${limit} upload limit on hosted deploy. Choose 50–200 rows from the dropdown, or split the CSV into smaller files.`,
    }
  }

  if (ctx.uploadBytes != null && ctx.uploadBytes > VERCEL_UPLOAD_LIMIT_BYTES) {
    return {
      title: "Upload slice still too large",
      description: `Even with the row cap, this slice is ${formatBytes(ctx.uploadBytes)} (limit ~${limit}). Try fewer rows (50 or 100) or split the CSV.`,
    }
  }

  return {
    title: "CSV file too large",
    description: `Hosted uploads are limited to ~${limit}. Choose fewer rows (50/100/200) or split the CSV.`,
  }
}

export function openCsvTooLargeDialog(
  show: (title: string, description: string) => void,
  ctx: CsvUploadTooLargeContext = {}
): void {
  const copy = getCsvTooLargeDialogContent(ctx)
  show(copy.title, copy.description)
}

export function isCsvTooLargeErrorMessage(message: string): boolean {
  return (
    message.startsWith("PREVIEW_TOO_LARGE") ||
    message.startsWith("PREVIEW_413") ||
    message.includes("too large") ||
    message.includes("Content Too Large")
  )
}
