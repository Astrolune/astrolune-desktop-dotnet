"use client"

import type React from "react"
import { PlusCircle } from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { Button } from "../button/button"
import { useTranslation } from "react-i18next"
import type { UserData } from "../../types"
import "./profile-card.scss"

interface ProfileCardProps {
  user: UserData
  displayName: string
  pronouns: string
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ user, displayName, pronouns }) => {
  const { t } = useTranslation("settings")

  return (
    <div className="profile-preview__card">
      <div className="profile-preview__banner">
        <div className="profile-preview__banner-decoration">+</div>
      </div>

      <div className="profile-preview__avatar-wrapper">
        <div className="profile-preview__avatar-container">
          <Avatar size={72} src={user.avatar.src} alt={user.nickname} />
          <button className="profile-preview__status-button">
            <PlusCircle size={12} />
            {t("add_status")}
          </button>
        </div>
      </div>

      <div className="profile-preview__content">
        <div className="profile-preview__name">{displayName || user.nickname}</div>
        <div className="profile-preview__username">
          {user.username}
          {pronouns && <span className="profile-preview__pronouns"> | {pronouns}</span>}
        </div>
        <Button theme="outline" className="profile-preview__example-button">
          {t("example_button")}
        </Button>
      </div>
    </div>
  )
}
