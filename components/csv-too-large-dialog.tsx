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

type CsvTooLargeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
}

export function CsvTooLargeDialog({ open, onOpenChange, title, description }: CsvTooLargeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm" className="data-[size=sm]:max-w-md sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="text-amber-600 dark:text-amber-400">
            <AlertTriangleIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function useCsvTooLargeDialog() {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("CSV file too large")
  const [description, setDescription] = React.useState("")

  const show = React.useCallback((nextTitle: string, nextDescription: string) => {
    setTitle(nextTitle)
    setDescription(nextDescription)
    setOpen(true)
  }, [])

  const dialog = (
    <CsvTooLargeDialog open={open} onOpenChange={setOpen} title={title} description={description} />
  )

  return { show, dialog }
}
