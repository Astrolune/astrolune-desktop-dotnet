"use client"

import React, { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { DeviceCameraIcon } from "@primer/octicons-react"

import { Avatar, Button, Modal } from ".."
import { api } from "../../lib/api-client"
import { useToast } from "../../hooks"

import "./avatar-edit.scss"

interface AvatarEditProps {
  trigger?: React.ReactNode
}

export const AvatarEditTrigger: React.FC<AvatarEditProps> = ({ trigger }) => {
  const { t } = useTranslation("user_profile")
  const [isOpen, setIsOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { showSuccessToast, showErrorToast } = useToast()

  const handleOpen = async () => {
    setIsOpen(true)

    try {
      const profile = await api.users.getMe()
      setCurrentImage(profile.avatar ?? null)
    } catch {
      setCurrentImage(null)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setSelectedImage(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSelectImage = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSelectedImage(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!selectedImage) {
      handleClose()
      return
    }

    setIsSaving(true)
    try {
      await api.users.updateMe({ avatar: selectedImage })
      const refreshed = await api.users.getMe().catch(() => null)
      setCurrentImage(refreshed?.avatar ?? selectedImage)
      showSuccessToast(t("saved_successfully"))
      handleClose()
    } catch {
      showErrorToast(t("try_again"))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      {trigger && (
        <div onClick={handleOpen} style={{ cursor: "pointer", display: "inline-block" }}>
          {trigger}
        </div>
      )}

      {isOpen && (
        <Modal onClose={handleClose} title={t("edit_profile")} clickOutsideToClose={false} isOpen={isOpen}>
          <div className="edit-profile-modal__form">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              hidden
            />

            <div className="edit-profile-modal__content" style={{ display: "flex", justifyContent: "center" }}>
              <button type="button" className="edit-profile-modal__avatar-container" onClick={handleSelectImage}>
                <Avatar size={128} src={selectedImage || currentImage || undefined} />
                <div className="edit-profile-modal__avatar-overlay">
                  <DeviceCameraIcon size={38} />
                </div>
              </button>
            </div>

            <Button disabled={isSaving} className="edit-profile-modal__submit" onClick={handleSave}>
              {isSaving ? t("saving") : t("save")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
