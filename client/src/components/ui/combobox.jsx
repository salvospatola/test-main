"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { Command as CommandPrimitive } from "cmdk"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const ComboboxContext = React.createContext(null)

export function useComboboxAnchor() {
  return React.useRef(null)
}

export function Combobox({
  children,
  items = [],
  multiple = false,
  value,
  onValueChange,
  autoHighlight = false,
}) {
  const [open, setPopoverOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")

  const selectedValues = multiple 
    ? (Array.isArray(value) ? value : []) 
    : (value ? [value] : [])

  const filteredItems = React.useMemo(() => {
    if (!searchTerm) return items
    return items.filter(item => {
      const label = (item.label || item).toString().toLowerCase()
      return label.includes(searchTerm.toLowerCase())
    })
  }, [items, searchTerm])

  const toggleValue = (val) => {
    if (multiple) {
      const newValues = selectedValues.includes(val)
        ? selectedValues.filter((v) => v !== val)
        : [...selectedValues, val]
      onValueChange?.(newValues)
    } else {
      onValueChange?.(val)
      setSearchTerm("")
      setPopoverOpen(false)
    }
  }

  return (
    <ComboboxContext.Provider value={{ 
      items, filteredItems, multiple, selectedValues, toggleValue, open, setPopoverOpen, searchTerm, setSearchTerm, autoHighlight 
    }}>
      <Popover open={open} onOpenChange={setPopoverOpen}>
        {children}
      </Popover>
    </ComboboxContext.Provider>
  )
}

export const ComboboxChips = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <PopoverTrigger asChild>
      <div
        ref={ref}
        className={cn(
          "flex min-h-10 w-full flex-wrap items-center justify-between gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text",
          className
        )}
        {...props}
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {children}
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
      </div>
    </PopoverTrigger>
  )
})
ComboboxChips.displayName = "ComboboxChips"

export function ComboboxValue({ children }) {
  const { selectedValues } = React.useContext(ComboboxContext)
  return typeof children === "function" ? children(selectedValues) : children
}

export function ComboboxChip({ children, className, onRemove, ...props }) {
  const { toggleValue, multiple } = React.useContext(ComboboxContext)
  
  const handleRemove = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onRemove) onRemove()
    else if (multiple && typeof children === 'string') toggleValue(children)
  }

  return (
    <Badge
      variant="default"
      className={cn("gap-1 pr-1 font-semibold h-6 text-[10px]", className)}
      {...props}
    >
      {children}
      <button
        type="button"
        className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-primary-foreground/20 transition-colors"
        onClick={handleRemove}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}

export function ComboboxChipsInput({ className, placeholder, onEnter, ...props }) {
  const { searchTerm, setSearchTerm, toggleValue, items, multiple } = React.useContext(ComboboxContext)
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault()
      if (onEnter) {
        onEnter(searchTerm.trim())
      } else if (multiple) {
        // Default behavior: add as new tag if allowed or toggle existing
        toggleValue(searchTerm.trim())
      }
      setSearchTerm("")
    }
  }

  return (
    <input
      className={cn("ml-1 flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-[60px]", className)}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={searchTerm === "" ? placeholder : ""}
      {...props}
    />
  )
}

export function ComboboxContent({ children, className, anchor }) {
  return (
    <PopoverContent 
      className={cn("w-[var(--radix-popover-trigger-width)] p-0", className)} 
      align="start"
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <CommandPrimitive className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
        {children}
      </CommandPrimitive>
    </PopoverContent>
  )
}

export function ComboboxEmpty({ children }) {
  const { filteredItems } = React.useContext(ComboboxContext)
  if (Array.isArray(filteredItems) && filteredItems.length > 0) return null
  return <div className="py-6 text-center text-sm">{children}</div>
}

export function ComboboxList({ children }) {
  const { filteredItems } = React.useContext(ComboboxContext)

  return (
    <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1">
      {filteredItems.map((item) => (
        <React.Fragment key={item.value || item.id || item}>
          {children(item)}
        </React.Fragment>
      ))}
    </div>
  )
}

export function ComboboxItem({ children, value, className }) {
  const { selectedValues, toggleValue } = React.useContext(ComboboxContext)
  const isSelected = selectedValues.includes(value)

  return (
    <div
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      onClick={() => toggleValue(value)}
    >
      <div className={cn(
        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
        isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
      )}>
        {isSelected && <Check className="h-3 w-3" />}
      </div>
      {children}
    </div>
  )
}

// Legacy support
export function ComboboxInput({ placeholder, className }) {
  const { setSearchTerm, searchTerm, selectedValues } = React.useContext(ComboboxContext)
  const hasValue = selectedValues.length > 0 && selectedValues[0] !== ""

  return (
    <PopoverTrigger asChild>
      <div className="relative w-full">
        <input
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            hasValue && "placeholder:text-foreground placeholder:opacity-100 font-medium",
            className
          )}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <ChevronsUpDown className="absolute right-3 top-3 h-4 w-4 shrink-0 opacity-50" />
      </div>
    </PopoverTrigger>
  )
}
