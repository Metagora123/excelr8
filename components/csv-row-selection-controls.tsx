"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isAllRowsPreviewBlocked } from "@/lib/csv-truncate"
import {
  DEFAULT_ROW_SELECTION_UI,
  normalizeRowSelectionUi,
  type RowSelectionUiState,
} from "@/lib/csv-row-selection"

type CsvRowSelectionControlsProps = {
  idPrefix: string
  file: File | null
  fileCsvRowCount: number | null
  value: RowSelectionUiState
  onChange: (next: RowSelectionUiState) => void
  firstRowsLabel?: string
}

export function CsvRowSelectionControls({
  idPrefix,
  file,
  fileCsvRowCount,
  value,
  onChange,
  firstRowsLabel = "Rows to use",
}: CsvRowSelectionControlsProps) {
  const setMode = (mode: "first" | "range") => {
    onChange(normalizeRowSelectionUi({ ...value, mode }, fileCsvRowCount))
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor={`${idPrefix}-mode`} className="text-xs text-muted-foreground whitespace-nowrap">
          Selection
        </Label>
        <Select value={value.mode} onValueChange={(v) => setMode(v as "first" | "range")}>
          <SelectTrigger id={`${idPrefix}-mode`} className="h-8 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="first">First N rows</SelectItem>
            <SelectItem value="range">Row range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.mode === "first" ? (
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-first`} className="text-xs text-muted-foreground whitespace-nowrap">
            {firstRowsLabel}
          </Label>
          <Select
            value={value.firstCount}
            onValueChange={(firstCount) => onChange({ ...value, firstCount })}
          >
            <SelectTrigger id={`${idPrefix}-first`} className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="150">150</SelectItem>
              <SelectItem value="200">200</SelectItem>
              <SelectItem value="all" disabled={isAllRowsPreviewBlocked(file)}>
                All
                {fileCsvRowCount != null ? ` (${fileCsvRowCount.toLocaleString()})` : ""}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">From row</Label>
          <Input
            id={`${idPrefix}-range-start`}
            type="number"
            min={1}
            max={fileCsvRowCount ?? undefined}
            className="h-8 w-20"
            value={value.rangeStart}
            onChange={(e) =>
              onChange(
                normalizeRowSelectionUi(
                  { ...value, rangeStart: Number(e.target.value) || 1 },
                  fileCsvRowCount
                )
              )
            }
          />
          <Label className="text-xs text-muted-foreground whitespace-nowrap">to</Label>
          <Input
            id={`${idPrefix}-range-end`}
            type="number"
            min={value.rangeStart}
            max={fileCsvRowCount ?? undefined}
            className="h-8 w-20"
            value={value.rangeEnd}
            onChange={(e) =>
              onChange(
                normalizeRowSelectionUi(
                  { ...value, rangeEnd: Number(e.target.value) || value.rangeStart },
                  fileCsvRowCount
                )
              )
            }
          />
          {fileCsvRowCount != null && (
            <span className="text-xs text-muted-foreground">of {fileCsvRowCount.toLocaleString()}</span>
          )}
        </div>
      )}
    </div>
  )
}

export { DEFAULT_ROW_SELECTION_UI }
