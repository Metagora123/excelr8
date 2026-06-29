/**
 * CSV row selection for preview / upload (first N rows or 1-based inclusive range).
 */

export type CsvRowSelection =
  | { kind: "first"; count: string }
  | { kind: "range"; start: number; end: number }

export type RowSelectionUiState = {
  mode: "first" | "range"
  firstCount: string
  rangeStart: number
  rangeEnd: number
}

export const DEFAULT_ROW_SELECTION_UI: RowSelectionUiState = {
  mode: "first",
  firstCount: "50",
  rangeStart: 1,
  rangeEnd: 50,
}

export function toCsvRowSelection(state: RowSelectionUiState): CsvRowSelection {
  if (state.mode === "range") {
    return { kind: "range", start: state.rangeStart, end: state.rangeEnd }
  }
  return { kind: "first", count: state.firstCount }
}

export function describeCsvRowSelection(
  selection: CsvRowSelection,
  fileCsvRowCount?: number | null
): string {
  if (selection.kind === "range") {
    return `rows ${selection.start}–${selection.end}`
  }
  if (selection.count === "all") {
    return fileCsvRowCount != null ? `all ${fileCsvRowCount.toLocaleString()} rows` : "all rows"
  }
  return `first ${selection.count} rows`
}

export function isAllRowsSelection(selection: CsvRowSelection): boolean {
  return selection.kind === "first" && selection.count === "all"
}

/** Clamp range to valid 1-based bounds when file row count is known. */
export function normalizeRowSelectionUi(
  state: RowSelectionUiState,
  fileCsvRowCount: number | null
): RowSelectionUiState {
  if (state.mode !== "range") return state
  const max = fileCsvRowCount != null && fileCsvRowCount > 0 ? fileCsvRowCount : state.rangeEnd
  let start = Math.max(1, Math.floor(state.rangeStart) || 1)
  let end = Math.max(start, Math.floor(state.rangeEnd) || start)
  if (fileCsvRowCount != null && fileCsvRowCount > 0) {
    start = Math.min(start, fileCsvRowCount)
    end = Math.min(end, fileCsvRowCount)
    if (end < start) end = start
  }
  return { ...state, rangeStart: start, rangeEnd: end }
}
