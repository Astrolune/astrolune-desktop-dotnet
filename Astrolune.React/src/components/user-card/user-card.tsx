"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { MessageCircle, UserPlus } from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { useTranslation } from "react-i18next"
import type { UserData } from "../../types"
import cn from "classnames"
import "./user-card.scss"

interface UserCardProps {
  data: UserData
  onMessage?: () => void
  onAddFriend?: () => void
  showActions?: boolean
}

export const UserCard: React.FC<UserCardProps> = ({ data, onMessage, onAddFriend, showActions = true }) => {
  const { avatar, banner, username, nickname, bio, status = "online", pronouns, activity } = data
  const [playTime, setPlayTime] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const { t } = useTranslation("user_card")

  useEffect(() => {
    if (!activity?.startTime) return

    const calculatePlayTime = () => {
      const now = Date.now()
      const diff = now - activity.startTime
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setPlayTime({ hours, minutes, seconds })
    }

    calculatePlayTime()
    const interval = setInterval(calculatePlayTime, 1000)
    return () => clearInterval(interval)
  }, [activity?.startTime])

  const formatTime = (value: number): string => value.toString().padStart(2, "0")

  const playTimeString = useMemo(
    () => `${formatTime(playTime.hours)}:${formatTime(playTime.minutes)}:${formatTime(playTime.seconds)}`,
    [playTime],
  )

  return (
    <div className="user-card">
      <div className="user-card__banner">{banner && <img src={banner || "/placeholder.svg"} alt="" />}</div>

      <div className="user-card__avatar-section">
        <div className="user-card__avatar-wrapper">
          <div className="user-card__avatar-border">
            <Avatar size={72} src={avatar.src} alt={avatar.alt || nickname} />
          </div>
          <div className={cn("user-card__status-badge", `user-card__status-badge--${status}`)} />
        </div>
      </div>

      <div className="user-card__content">
        <h3 className="user-card__name">{nickname}</h3>
        <div className="user-card__username">
          {username}
          {pronouns && <span className="user-card__pronouns"> • {pronouns}</span>}
        </div>

        <div className="user-card__divider" />

        {bio && (
          <div className="user-card__section">
            <div className="user-card__section-title">{t("about_me")}</div>
            <div className="user-card__bio">{bio}</div>
          </div>
        )}

        {activity && (
          <div className="user-card__section">
            <div className="user-card__section-title">{t("playing")}</div>
            <div className="user-card__activity">
              <div className="user-card__activity-icon">
                {activity.icon && <img src={activity.icon || "/placeholder.svg"} alt={activity.gameName} />}
              </div>
              <div className="user-card__activity-info">
                <div className="user-card__activity-game">{activity.gameName}</div>
                <div className="user-card__activity-time">{playTimeString}</div>
              </div>
            </div>
          </div>
        )}

        {showActions && (
          <div className="user-card__actions">
            <button className="user-card__action user-card__action--primary" onClick={onMessage}>
              <MessageCircle size={16} />
              {t("message")}
            </button>
            <button className="user-card__action user-card__action--secondary" onClick={onAddFriend}>
              <UserPlus size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default UserCard
