"use client"

import { LanguagesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"

export function LanguageSwitcher() {
  const { t, toggleLocale } = useI18n()

  return (
    <Button variant="outline" onClick={toggleLocale}>
      <LanguagesIcon data-icon="inline-start" />
      {t.switchLanguage}
    </Button>
  )
}
