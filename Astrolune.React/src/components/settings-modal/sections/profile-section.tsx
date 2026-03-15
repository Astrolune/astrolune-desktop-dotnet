"use client"

import type React from "react"
import { PlusCircle, Sparkles } from "lucide-react"
import { GearIcon } from "@primer/octicons-react"
import { Avatar } from "../../avatar/avatar"
import { TextField } from "../../text-field/text-field"
import { Button } from "../../button/button"
import { useTranslation } from "react-i18next"
import type { UserData } from "../../../types"
import { ProfileCard } from "../../profile-card/profile-card"

export interface ProfileSectionProps {
  user: UserData
  displayName: string
  pronouns: string
  onDisplayNameChange: (value: string) => void
  onPronounsChange: (value: string) => void
  onSaveProfile: () => void
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  user,
  displayName,
  pronouns,
  onDisplayNameChange,
  onPronounsChange,
  onSaveProfile,
}) => {
  const { t } = useTranslation("settings")

  return (
    <div className="settings-section">
      <div className="profile-banner">
        <div className="profile-banner__decoration profile-banner__decoration--tl">+</div>
        <div className="profile-banner__decoration profile-banner__decoration--tr">+</div>
        <div className="profile-banner__decoration profile-banner__decoration--bl">+</div>
        <div className="profile-banner__decoration profile-banner__decoration--br">+</div>
        <div className="profile-banner__content">
          <div className="profile-banner__icon">
            <GearIcon size={32} />
          </div>
          <div className="profile-banner__text">
            <h3>{t("fresh_look")}</h3>
            <p>{t("fresh_look_description")}</p>
          </div>
        </div>
      </div>

      <div className="profile-form">
        <div className="profile-form__fields">

          <div className="profile-form__fields-group">
            <TextField
              label={t("display_name")}
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              theme="dark"
            />
            <TextField
              label={t("pronouns")}
              value={pronouns}
              onChange={(e) => onPronounsChange(e.target.value)}
              placeholder={t("pronouns_placeholder")}
              theme="dark"
            />
          </div>

          <div className="profile-form__divider" />

          <div className="profile-form__field">
            <div className="profile-form__subtitle">{t("avatar")}</div>
            <div className="profile-form__actions">
              <Button theme="outline" onClick={onSaveProfile}>
                {t("change_avatar")}
              </Button>
              <Button theme="outline">{t("remove_avatar")}</Button>
            </div>
          </div>
        </div>

        <div className="profile-preview">
          <div className="profile-preview__label">{t("preview")}</div>
          <ProfileCard user={user} displayName={displayName} pronouns={pronouns} />
          <div className="premium-banner">
            <div className="premium-banner__content">
              <Sparkles size={50} />
              <span className="premium-banner__text">
                {t("level_up_look")} <span>{t("premium")}</span>
              </span>
            </div>
            <Button theme="outline" className="premium-banner__button">
              <Sparkles size={16} />
              {t("try_it_out")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
