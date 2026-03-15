"use client"

import type React from "react"
import { PersonIcon } from "@primer/octicons-react"
import { Shield, LogOut } from "lucide-react"
import { TextField } from "../../text-field/text-field"
import { Button } from "../../button/button"
import { useTranslation } from "react-i18next"

interface AccountSectionProps {
  email: string
  username: string
  phone: string
  isSaving: boolean
  isIdentityEditable?: boolean
  onEmailChange: (value: string) => void
  onUsernameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onSave: () => void
  onLogoutAllDevices: () => void
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  email,
  username,
  phone,
  isSaving,
  isIdentityEditable = false,
  onEmailChange,
  onUsernameChange,
  onPhoneChange,
  onSave,
  onLogoutAllDevices,
}) => {
  const { t } = useTranslation("settings")

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <PersonIcon size={24} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("account_info")}</h3>
            <p className="settings-card__subtitle">{t("account_info_desc")}</p>
          </div>
        </div>
        <div className="settings-card__content">
          <div className="settings-card__fields">
            <TextField
              label={t("email_label")}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              theme="dark"
              type="email"
              readOnly={!isIdentityEditable}
            />
            <TextField
              label={t("username_label")}
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              theme="dark"
              readOnly={!isIdentityEditable}
            />
            <TextField
              label={t("phone_label", { defaultValue: "Phone" })}
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              theme="dark"
            />
          </div>
          <div className="settings-card__actions">
            <Button theme="outline" onClick={onSave} disabled={isSaving}>
              {isSaving ? t("saving") : t("save_changes")}
            </Button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <Shield size={24} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("password_auth")}</h3>
            <p className="settings-card__subtitle">{t("password_description")}</p>
          </div>
        </div>
        <div className="settings-card__content">
          <div className="settings-card__actions">
            <Button theme="outline">{t("change_password")}</Button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__header">
          <div className="settings-card__icon">
            <LogOut size={24} />
          </div>
          <div className="settings-card__title-group">
            <h3 className="settings-card__title">{t("session_management", { defaultValue: "Session Management" })}</h3>
            <p className="settings-card__subtitle">{t("session_management_desc", { defaultValue: "Manage active sessions on your devices." })}</p>
          </div>
        </div>
        <div className="settings-card__content">
          <div className="settings-card__actions">
            <Button theme="outline" onClick={onLogoutAllDevices}>
              <LogOut size={16} />
              {t("logout_all_devices")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
