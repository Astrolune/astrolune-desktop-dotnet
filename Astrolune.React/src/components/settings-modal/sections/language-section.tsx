"use client"

import type React from "react"
import { Check } from "lucide-react"
import { GlobeIcon } from "@primer/octicons-react"
import { useTranslation } from "react-i18next"
import cn from "classnames"

const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
]

interface LanguageSectionProps {
  currentLanguage: string
  onLanguageChange: (langCode: string) => void
}

export const LanguageSection: React.FC<LanguageSectionProps> = ({ currentLanguage, onLanguageChange }) => {
  const { t } = useTranslation("settings")

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <GlobeIcon size={24} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("select_language")}</h3>
            <p className="settings-card__subtitle">{t("language_description")}</p>
          </div>
        </div>
        <div className="settings-card__content">
          <div className="language-grid">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                className={cn("language-card", {
                  "language-card--active": currentLanguage === lang.code,
                })}
                onClick={() => onLanguageChange(lang.code)}
              >
                <div className="language-card__info">
                  <div className="language-card__name">{lang.nativeName}</div>
                  <div className="language-card__native">{lang.name}</div>
                </div>
                {currentLanguage === lang.code && (
                  <div className="language-card__check">
                    <Check size={18} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
