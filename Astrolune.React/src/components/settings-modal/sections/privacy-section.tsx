"use client"

import type React from "react"
import { MessageSquare, Eye, Download } from "lucide-react"
import { ShieldLockIcon } from "@primer/octicons-react"
import { CheckboxField } from "../../checkbox-field/checkbox-field"
import { Button } from "../../button/button"
import { useTranslation } from "react-i18next"

interface PrivacySectionProps {
  allowDMs: boolean
  allowFriendRequests: boolean
  showOnlineStatus: boolean
  showActivity: boolean
  allowServerInvites: boolean
  messageScanning: boolean
  dataCollection: boolean
  onAllowDMsChange: (value: boolean) => void
  onAllowFriendRequestsChange: (value: boolean) => void
  onShowOnlineStatusChange: (value: boolean) => void
  onShowActivityChange: (value: boolean) => void
  onAllowServerInvitesChange: (value: boolean) => void
  onMessageScanningChange: (value: boolean) => void
  onDataCollectionChange: (value: boolean) => void
}

export const PrivacySection: React.FC<PrivacySectionProps> = ({
  allowDMs,
  allowFriendRequests,
  showOnlineStatus,
  showActivity,
  allowServerInvites,
  messageScanning,
  dataCollection,
  onAllowDMsChange,
  onAllowFriendRequestsChange,
  onShowOnlineStatusChange,
  onShowActivityChange,
  onAllowServerInvitesChange,
  onMessageScanningChange,
  onDataCollectionChange,
}) => {
  const { t } = useTranslation("settings")

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <MessageSquare size={24} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("direct_messages")}</h3>
            <p className="settings-card__subtitle">{t("dm_description")}</p>
          </div>
        </div>
        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              label={t("allow_dms_everyone")}
              checked={allowDMs}
              onChange={(e) => onAllowDMsChange(e.target.checked)}
            />
            <CheckboxField
              label={t("allow_friend_requests")}
              checked={allowFriendRequests}
              onChange={(e) => onAllowFriendRequestsChange(e.target.checked)}
            />
            <CheckboxField
              label={t("allow_server_invites")}
              checked={allowServerInvites}
              onChange={(e) => onAllowServerInvitesChange(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <Eye size={24} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("activity_status")}</h3>
            <p className="settings-card__subtitle">{t("activity_description")}</p>
          </div>
        </div>
        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              label={t("show_online_status")}
              checked={showOnlineStatus}
              onChange={(e) => onShowOnlineStatusChange(e.target.checked)}
            />
            <CheckboxField
              label={t("show_current_activity")}
              checked={showActivity}
              onChange={(e) => onShowActivityChange(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <ShieldLockIcon size={24} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("data_safety")}</h3>
            <p className="settings-card__subtitle">{t("data_safety_description")}</p>
          </div>
        </div>
        <div className="settings-card__content">
          <div className="settings-card__options">
            <CheckboxField
              label={t("message_scanning")}
              checked={messageScanning}
              onChange={(e) => onMessageScanningChange(e.target.checked)}
            />
            <CheckboxField
              label={t("data_collection")}
              checked={dataCollection}
              onChange={(e) => onDataCollectionChange(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <Download size={24} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("data_usage")}</h3>
            <p className="settings-card__subtitle">{t("data_usage_description")}</p>
          </div>
        </div>
        <div className="settings-card__content">
          <div className="settings-card__actions">
            <Button theme="outline">{t("request_data")}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
