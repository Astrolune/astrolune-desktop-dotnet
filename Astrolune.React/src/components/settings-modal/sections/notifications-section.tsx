"use client"

import type React from "react"
import { Monitor, MessageSquare } from "lucide-react"
import { CheckboxField } from "../../checkbox-field/checkbox-field"
import { useTranslation } from "react-i18next"

interface NotificationsSectionProps {
  enableDesktopNotifications: boolean
  enableSoundNotifications: boolean
  enableMessageNotifications: boolean
  enableMentionNotifications: boolean
  enableFriendNotifications: boolean
  flashTaskbar: boolean
  onDesktopNotificationsChange: (value: boolean) => void
  onSoundNotificationsChange: (value: boolean) => void
  onMessageNotificationsChange: (value: boolean) => void
  onMentionNotificationsChange: (value: boolean) => void
  onFriendNotificationsChange: (value: boolean) => void
  onFlashTaskbarChange: (value: boolean) => void
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  enableDesktopNotifications,
  enableSoundNotifications,
  enableMessageNotifications,
  enableMentionNotifications,
  enableFriendNotifications,
  flashTaskbar,
  onDesktopNotificationsChange,
  onSoundNotificationsChange,
  onMessageNotificationsChange,
  onMentionNotificationsChange,
  onFriendNotificationsChange,
  onFlashTaskbarChange,
}) => {
  const { t } = useTranslation("settings")

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <Monitor size={24} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("desktop_notifications")}</h3>
            <p className="settings-card__subtitle">{t("desktop_notifications_desc")}</p>
          </div>
        </div>
        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              label={t("enable_desktop_notifications")}
              checked={enableDesktopNotifications}
              onChange={(e) => onDesktopNotificationsChange(e.target.checked)}
            />
            <CheckboxField
              label={t("enable_sound_notifications")}
              checked={enableSoundNotifications}
              onChange={(e) => onSoundNotificationsChange(e.target.checked)}
            />
            <CheckboxField
              label={t("flash_taskbar")}
              checked={flashTaskbar}
              onChange={(e) => onFlashTaskbarChange(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <MessageSquare size={24} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("message_notifications")}</h3>
            <p className="settings-card__subtitle">{t("message_notifications_desc")}</p>
          </div>
        </div>
        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              label={t("enable_message_notifications")}
              checked={enableMessageNotifications}
              onChange={(e) => onMessageNotificationsChange(e.target.checked)}
            />
            <CheckboxField
              label={t("enable_mention_notifications")}
              checked={enableMentionNotifications}
              onChange={(e) => onMentionNotificationsChange(e.target.checked)}
            />
            <CheckboxField
              label={t("enable_friend_notifications")}
              checked={enableFriendNotifications}
              onChange={(e) => onFriendNotificationsChange(e.target.checked)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
