import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const Field = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props} />
))
Field.displayName = "Field"

const FieldLabel = React.forwardRef(({ className, ...props }, ref) => (
  <Label
    ref={ref}
    className={cn("text-xs font-semibold ml-1 text-muted-foreground", className)}
    {...props}
  />
))
FieldLabel.displayName = "FieldLabel"

const FieldDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[0.8rem] text-muted-foreground", className)}
    {...props}
  />
))
FieldDescription.displayName = "FieldDescription"

export { Field, FieldLabel, FieldDescription }
