"use client"

import * as React from "react"
import { Calendar as CalendarIcon, Clock, ChevronDown } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

export function DatePicker({ value, onChange, placeholder = "Wähle ein Datum", className, ...calendarProps }) {
  const [open, setOpen] = React.useState(false)
  const date = value ? new Date(value) : null
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-empty={!date}
          className={cn(
            "data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal",
            className
          )}
        >
          {date ? format(date, "PPP", { locale: de }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : '');
            setOpen(false);
          }}
          initialFocus
          locale={de}
          defaultMonth={date || undefined}
          {...calendarProps}
        />
      </PopoverContent>
    </Popover>
  )
}

export function TimePicker({ value, onChange, className }) {
  const timeValue = value ? value.split(' ')[0] : "10:30"

  return (
    <div className={cn("relative", className)}>
      <Input
        type="time"
        value={timeValue}
        onChange={(e) => onChange(`${e.target.value} Uhr`)}
        className="bg-background h-10"
      />
    </div>
  )
}

export function DateTimePicker({ value, onChange, className }) {
  const [open, setOpen] = React.useState(false)
  const date = value ? new Date(value) : new Date()
  
  const handleDateChange = (newDate) => {
    if (!newDate) return
    const updated = new Date(date)
    updated.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate())
    onChange(updated.toISOString())
    setOpen(false)
  }

  const handleTimeChange = (t) => {
    const [h, m] = t.split(':')
    const updated = new Date(date)
    updated.setHours(parseInt(h), parseInt(m))
    onChange(updated.toISOString())
  }

  return (
    <div className={cn("flex flex-col sm:flex-row gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            data-empty={!value}
            className={cn(
              "data-[empty=true]:text-muted-foreground flex-1 justify-between text-left font-normal h-10 px-3 py-2"
            )}
          >
            {value ? format(date, "PPP", { locale: de }) : <span>Pick a date</span>}
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateChange}
            initialFocus
            locale={de}
            defaultMonth={date || undefined}
          />
        </PopoverContent>
      </Popover>
      
      <Input
        type="time"
        value={format(date, "HH:mm")}
        onChange={(e) => handleTimeChange(e.target.value)}
        className="bg-background w-full sm:w-[120px] h-10"
      />
    </div>
  )
}
