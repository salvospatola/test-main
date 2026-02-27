import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "!rounded-md bg-primary text-primary-foreground !shadow-none hover:bg-primary/90 hover:text-primary-foreground hover:shadow-[inset_0_0_0_1px_rgba(161,206,217,0.45)] active:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-500 dark:hover:bg-emerald-500/90",
        outline:
          "border-0 bg-[rgb(249,245,239)] text-[#2b2f38] hover:bg-[rgb(238,228,216)] hover:text-[#17192b] data-[state=on]:bg-[rgb(233,202,169)] data-[state=on]:text-[#2b2f38] data-[state=on]:hover:bg-[rgb(223,189,152)] data-[state=on]:hover:text-[#17192b] aria-pressed:bg-[rgb(233,202,169)] aria-pressed:text-[#2b2f38] aria-pressed:hover:bg-[rgb(223,189,152)] aria-pressed:hover:text-[#17192b]",
        secondary:
          "!border-0 !bg-[rgb(161,206,217)] !text-[#1f2a37] hover:!bg-[rgb(148,197,209)] hover:!text-[#17192b] data-[state=on]:!bg-[rgb(233,202,169)] data-[state=on]:!text-[#2b2f38] data-[state=on]:hover:!bg-[rgb(223,189,152)] data-[state=on]:hover:!text-[#17192b] aria-pressed:!bg-[rgb(233,202,169)] aria-pressed:!text-[#2b2f38] aria-pressed:hover:!bg-[rgb(223,189,152)] aria-pressed:hover:!text-[#17192b]",
        ghost: "hover:bg-[rgb(249,245,239)] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled = false,
  onClick,
  children,
  ...props
}, ref) => {
  const [pending, setPending] = React.useState(false)
  const canUseSlotChild = asChild && React.Children.count(children) === 1 && React.isValidElement(children)
  const Comp = canUseSlotChild ? Slot : "button"
  const isBusy = Boolean(loading || pending)

  const handleClick = async (event) => {
    if (disabled || isBusy) {
      event.preventDefault()
      return
    }
    if (!onClick) return
    const result = onClick(event)
    if (result && typeof result.then === "function") {
      setPending(true)
      try {
        await result
      } finally {
        setPending(false)
      }
    }
  }

  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      aria-busy={isBusy || undefined}
      disabled={disabled || isBusy}
      onClick={handleClick}
      ref={ref}
      {...props}>
      {children}
    </Comp>)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
