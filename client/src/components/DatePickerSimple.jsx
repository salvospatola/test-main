"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { de } from "date-fns/locale"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerSimple({ value, onChange }) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState(undefined)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)")
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  React.useEffect(() => {
    if (!value) {
      setDate(undefined)
      return
    }
    const parsed = new Date(value)
    setDate(Number.isNaN(parsed.getTime()) ? undefined : parsed)
  }, [value])

  if (isMobile) {
    return (
      <Field className="w-full">
        <FieldLabel htmlFor="date">Geburtsdatum</FieldLabel>
        <Input
          id="date"
          type="date"
          value={value || ""}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </Field>
    )
  }

  return (
    <Field className="w-full">
      <FieldLabel htmlFor="date">Geburtsdatum</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date"
            className="w-full justify-start font-normal"
          >
            {date ? date.toLocaleDateString("de-DE") : "Datum wählen"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            captionLayout="dropdown"
            locale={de}
            onSelect={(date) => {
              setDate(date)
              if (onChange) {
                if (!date) {
                  onChange("")
                } else {
                  const y = date.getFullYear()
                  const m = String(date.getMonth() + 1).padStart(2, "0")
                  const d = String(date.getDate()).padStart(2, "0")
                  onChange(`${y}-${m}-${d}`)
                }
              }
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </Field>
  )
}
