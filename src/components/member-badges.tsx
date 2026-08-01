/* eslint-disable react-refresh/only-export-components */
import { Star } from "lucide-react"

import { cn } from "@/lib/utils"

export const skillLabels: Record<number, { label: string; color: string }> = {
  1: { label: "Mới chơi", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  2: { label: "Trung bình", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  3: { label: "Khá", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  4: { label: "Mạnh", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
}

export function SkillBadge({ level, size = "md" }: { level: number; size?: "sm" | "md" }) {
  const info = skillLabels[level] || skillLabels[1]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        info.color
      )}
    >
      <Star className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} /> {info.label}
    </span>
  )
}

export function MemberTypeBadge({
  type,
  size = "md",
}: {
  type?: "employee" | "guest" | "regular"
  size?: "sm" | "md"
}) {
  const t = type || "regular"
  const common = "inline-flex items-center rounded-full font-bold whitespace-nowrap"
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"

  if (t === "employee") {
    return (
      <span className={cn(
        common,
        padding,
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
      )}>
        Nhân viên
      </span>
    )
  }
  if (t === "guest") {
    return (
      <span className={cn(
        common,
        padding,
        "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
      )}>
        Vãng lai
      </span>
    )
  }
  return (
    <span className={cn(
      common,
      padding,
      "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
    )}>
      Thường
    </span>
  )
}
