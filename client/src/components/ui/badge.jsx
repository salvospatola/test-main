import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border-transparent bg-[rgb(161,206,217)] text-[#1f2a37] hover:bg-[rgb(148,197,209)]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground bg-[rgb(249,245,239)] border-[rgb(161,206,217)]/45",
        success: "border-transparent bg-emerald-500 text-white hover:bg-emerald-500/80",
        warning: "border-transparent bg-[rgb(237,132,91)] text-[rgb(108,50,28)] hover:bg-[rgb(231,122,80)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
