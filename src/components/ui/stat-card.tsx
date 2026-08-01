import * as React from "react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

type Tone = "default" | "success" | "danger" | "info" | "warning"

const toneValueClass: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-destructive",
  info: "text-info",
  warning: "text-warning",
}

const toneIconClass: Record<Tone, string> = {
  default: "bg-muted text-foreground",
  success: "bg-success/15 text-success",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/15 text-info",
  warning: "bg-warning/15 text-warning",
}

interface StatCardProps {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  /** horizontal = icon beside value; vertical = title row with icon, value below */
  variant?: "horizontal" | "vertical"
  className?: string
  /** Staggered entrance delay (ms). Set on each card for a load-in wave. */
  revealDelay?: number
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
  variant = "horizontal",
  className,
  revealDelay,
}: StatCardProps) {
  const revealClass =
    revealDelay !== undefined
      ? "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both motion-reduce:animate-none"
      : ""

  if (variant === "vertical") {
    return (
      <Card
        className={cn(revealClass, className)}
        style={revealDelay !== undefined ? { animationDelay: `${revealDelay}ms` } : undefined}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {Icon ? (
              <span className={cn("rounded-lg p-1.5", toneIconClass[tone])}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : null}
          </div>
          <div className={cn("mt-1 text-2xl font-bold tabular-nums leading-tight", toneValueClass[tone])}>
            {value}
          </div>
          {detail ? <p className="mt-1 text-xs text-muted-foreground leading-snug">{detail}</p> : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(revealClass, className)}
      style={revealDelay !== undefined ? { animationDelay: `${revealDelay}ms` } : undefined}
    >
      <CardContent className="flex items-center gap-3 p-4">
        {Icon ? (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", toneIconClass[tone])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-bold tabular-nums leading-tight", toneValueClass[tone])}>{value}</p>
          {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}
