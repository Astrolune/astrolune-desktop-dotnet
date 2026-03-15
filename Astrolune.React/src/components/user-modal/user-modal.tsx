"use client"
import { useRef, useEffect } from "react"
import { Avatar } from "../avatar/avatar"
import { X, MessageCircle, UserPlus, MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { UserData } from "../../types"
import "./user-modal.scss"

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  user: UserData
  onMessage?: () => void
  onAddFriend?: () => void
}

export function UserModal({ isOpen, onClose, user, onMessage, onAddFriend }: UserModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation("user_card")

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const { avatar, banner, username, nickname, bio, status = "online", pronouns, activity } = user

  return (
    <div className="user-modal-backdrop" onClick={onClose}>
      <div ref={modalRef} className="user-modal" onClick={(e) => e.stopPropagation()}>
        <button className="user-modal__close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="user-modal__banner">{banner && <img src={banner || "/placeholder.svg"} alt="" />}</div>

        <div className="user-modal__content">
          <div className="user-modal__avatar-section">
            <div className="user-modal__avatar-wrapper">
              <div className="user-modal__avatar-border">
                <Avatar size={92} src={avatar.src} alt={avatar.alt || nickname} />
              </div>
              <div className={`user-modal__status-badge user-modal__status-badge--${status}`} />
            </div>
          </div>

          <div className="user-modal__header">
            <h2 className="user-modal__name">{nickname}</h2>
            <div className="user-modal__username">
              {username}
              {pronouns && <span className="user-modal__pronouns"> • {pronouns}</span>}
            </div>
          </div>

          <div className="user-modal__divider" />

          {bio && (
            <div className="user-modal__section">
              <div className="user-modal__section-title">{t("about_me")}</div>
              <div className="user-modal__bio">{bio}</div>
            </div>
          )}

          {activity && (
            <div className="user-modal__section">
              <div className="user-modal__section-title">{t("playing")}</div>
              <div className="user-modal__activity">
                <div className="user-modal__activity-icon">
                  {activity.icon && <img src={activity.icon || "/placeholder.svg"} alt={activity.gameName} />}
                </div>
                <div className="user-modal__activity-info">
                  <div className="user-modal__activity-game">{activity.gameName}</div>
                  {activity.details && <div className="user-modal__activity-details">{activity.details}</div>}
                </div>
              </div>
            </div>
          )}

          <div className="user-modal__actions">
            <button className="user-modal__action user-modal__action--primary" onClick={onMessage}>
              <MessageCircle size={18} />
              {t("message")}
            </button>
            <button className="user-modal__action user-modal__action--secondary" onClick={onAddFriend}>
              <UserPlus size={18} />
            </button>
            <button className="user-modal__action user-modal__action--secondary">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserModal
