import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

const ROLE_LABELS = {
  ADMIN: "Administrator",
  USER: "Benutzer",
  MEMBER: "Mitglied",
  GUEST: "Gast",
}

export function formatRoleLabel(roleName) {
  if (!roleName) return ""
  const normalized = String(roleName).toUpperCase()
  return ROLE_LABELS[normalized] || String(roleName)
}
