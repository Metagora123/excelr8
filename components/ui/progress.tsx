"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value = 0,
  max = 100,
  ...props
}: React.ComponentProps<"div"> & { value?: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, max ? (value / max) * 100 : value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <div
        className="bg-primary h-full rounded-full transition-all duration-300 ease-in-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export { Progress }
