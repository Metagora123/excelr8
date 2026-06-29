"use client"

import * as React from "react"
import { AlertTriangleIcon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { InlineStreamErrorDetail } from "@/lib/inline-stream-errors"

type InlineStreamErrorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: InlineStreamErrorDetail | null
}

export function InlineStreamErrorDialog({ open, onOpenChange, detail }: InlineStreamErrorDialogProps) {
  if (!detail) return null
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm" className="data-[size=sm]:max-w-lg sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogMedia className="text-destructive">
            <AlertTriangleIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{detail.title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm">
              <p>{detail.summary}</p>
              <div>
                <p className="font-medium text-foreground">Why this happened</p>
                <p className="text-muted-foreground">{detail.why}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">How to fix</p>
                <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                  {detail.howToFix.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground break-all">{detail.technical}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function InlineStreamErrorPanel({ detail }: { detail: InlineStreamErrorDetail }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2">
      <p className="font-medium text-destructive">
        {detail.code}: {detail.title}
      </p>
      <p>{detail.summary}</p>
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Why: </span>
        {detail.why}
      </p>
      <div className="text-muted-foreground">
        <p className="font-medium text-foreground">How to fix:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          {detail.howToFix.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function useInlineStreamErrorDialog() {
  const [open, setOpen] = React.useState(false)
  const [detail, setDetail] = React.useState<InlineStreamErrorDetail | null>(null)

  const show = React.useCallback((next: InlineStreamErrorDetail) => {
    setDetail(next)
    setOpen(true)
  }, [])

  const dialog = <InlineStreamErrorDialog open={open} onOpenChange={setOpen} detail={detail} />

  return { show, detail, setDetail, dialog }
}
