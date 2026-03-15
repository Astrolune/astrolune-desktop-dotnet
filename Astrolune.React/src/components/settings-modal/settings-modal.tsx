"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X, Pencil } from "lucide-react"
import { PersonIcon, GlobeIcon, ShieldLockIcon, UnmuteIcon, BellIcon } from "@primer/octicons-react"
import { Avatar } from "../avatar/avatar"
import { Backdrop } from "../backdrop/backdrop"
import { TextField } from "../text-field/text-field"
import { useCall } from "../../contexts/call-context"
import { useAuthSession } from "../../contexts/auth-context"
import { useToast } from "../../hooks/useToast"
import { fetchWithOptionalAuth } from "../../lib/auth/session"
import { useTranslation } from "react-i18next"
import type { SettingsCategory, UserData } from "../../types"
import cn from "classnames"
import "./settings-modal.scss"

import {
  ProfileSection,
  VoiceVideoSection,
  AccountSection,
  PrivacySection,
  NotificationsSection,
  LanguageSection,
} from "./sections"

interface AudioDevice {
  deviceId: string
  label: string
  kind: "audioinput" | "audiooutput" | "videoinput"
}

interface SettingsModalProps {
  visible: boolean
  onClose: () => void
  user: UserData
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    title: "user_settings",
    items: [
      { id: "account", label: "my_account", icon: <PersonIcon size={18} /> },
      { id: "privacy", label: "data_privacy", icon: <ShieldLockIcon size={18} /> },
      { id: "notifications", label: "notifications", icon: <BellIcon size={18} /> },
    ],
  },
  {
    title: "app_settings",
    items: [
      { id: "language", label: "language", icon: <GlobeIcon size={18} /> },
      { id: "voice", label: "voice_video", icon: <UnmuteIcon size={18} /> },
    ],
  },
]

const USER_API_BASE = (
  (import.meta.env.VITE_USER_API_URL as string | undefined) ||
  "http://localhost:5002/api/users"
).replace(/\/+$/, "")

interface UserProfilePayload {
  userId?: string
  displayName?: string
  bio?: string
  avatar?: string | null
  banner?: string | null
}

interface UserSettingsPayload {
  userId?: string
  theme?: string
  locale?: string
  notificationsEnabled?: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const readString = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return ""
}

const readBoolean = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "boolean") {
      return value
    }
  }
  return false
}

const parseApiError = (payload: unknown, fallback: string) => {
  if (!isRecord(payload)) {
    return fallback
  }

  return (
    readString(payload, "error", "message", "detail", "title") ||
    fallback
  )
}

const resolveSettingsLocale = (languageCode: string) =>
  languageCode.toLowerCase().startsWith("ru") ? "ru-RU" : "en-US"

const normalizeLanguageCode = (locale: string | undefined) =>
  locale?.toLowerCase().startsWith("ru") ? "ru" : "en"

const requestUserService = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers ?? {})
  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetchWithOptionalAuth(`${USER_API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  })

  const contentType = response.headers.get("content-type") ?? ""
  const hasJson = contentType.includes("application/json")
  const payload: unknown = hasJson ? await response.json() : null

  if (!response.ok) {
    throw new Error(parseApiError(payload, `Request failed (${response.status})`))
  }

  if (isRecord(payload)) {
    if (payload.success === false) {
      throw new Error(parseApiError(payload, "Request failed"))
    }
    if ((payload.success === true || payload.ok === true) && "data" in payload) {
      return payload.data as T
    }
  }

  return payload as T
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose, user }) => {
  const [isClosing, setIsClosing] = useState(false)
  const [activeSection, setActiveSection] = useState("profiles")
  const [displayName, setDisplayName] = useState(user.nickname)
  const [profileBio, setProfileBio] = useState(user.bio || "")
  const [pronouns, setPronouns] = useState(user.pronouns || "")
  const [searchQuery, setSearchQuery] = useState("")

  // Account settings state
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState(user.username)
  const [phone, setPhone] = useState("")
  const [isSavingAccount, setIsSavingAccount] = useState(false)

  // Privacy settings state
  const [allowDMs, setAllowDMs] = useState(true)
  const [allowFriendRequests, setAllowFriendRequests] = useState(true)
  const [showOnlineStatus, setShowOnlineStatus] = useState(true)
  const [showActivity, setShowActivity] = useState(true)
  const [allowServerInvites, setAllowServerInvites] = useState(true)
  const [messageScanning, setMessageScanning] = useState(true)
  const [dataCollection, setDataCollection] = useState(false)

  // Notification settings state
  const [enableDesktopNotifications, setEnableDesktopNotifications] = useState(true)
  const [enableSoundNotifications, setEnableSoundNotifications] = useState(true)
  const [enableMessageNotifications, setEnableMessageNotifications] = useState(true)
  const [enableMentionNotifications, setEnableMentionNotifications] = useState(true)
  const [enableFriendNotifications, setEnableFriendNotifications] = useState(true)
  const [flashTaskbar, setFlashTaskbar] = useState(true)

  // Voice & Video settings state
  const [inputVolume, setInputVolume] = useState(100)
  const [outputVolume, setOutputVolume] = useState(100)
  const [noiseSuppression, setNoiseSuppression] = useState(true)
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [autoGainControl, setAutoGainControl] = useState(true)
  const [pushToTalk, setPushToTalk] = useState(false)
  const [voiceActivityDetection, setVoiceActivityDetection] = useState(true)
  const [autoAdjustMic, setAutoAdjustMic] = useState(true)
  const [hardwareMute, setHardwareMute] = useState(false)
  const [hardwareAcceleration, setHardwareAcceleration] = useState(false)
  const [videoQuality, setVideoQuality] = useState("720p")
  const [videoFps, setVideoFps] = useState("30")
  const [screenShareQuality, setScreenShareQuality] = useState("720p")
  const [screenShareFps, setScreenShareFps] = useState("30")

  // Device state
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [selectedMicId, setSelectedMicId] = useState("")
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("")
  const [selectedCameraId, setSelectedCameraId] = useState("")

  const modalRef = useRef<HTMLDivElement>(null)
  const call = useCall()
  const { user: authUser, signOut } = useAuthSession()
  const { showSuccessToast, showErrorToast, showWarningToast } = useToast()
  const { t, i18n } = useTranslation("settings")

  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || "en")
  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message
    }
    return fallback
  }, [])

  const applyLocalSettings = useCallback((settings: Record<string, unknown>) => {
    const privacy = settings.privacy as Record<string, boolean> | undefined
    if (privacy) {
      setAllowDMs(privacy.allowDMs ?? true)
      setAllowFriendRequests(privacy.allowFriendRequests ?? true)
      setShowOnlineStatus(privacy.showOnlineStatus ?? true)
      setShowActivity(privacy.showActivity ?? true)
      setAllowServerInvites(privacy.allowServerInvites ?? true)
      setMessageScanning(privacy.messageScanning ?? true)
      setDataCollection(privacy.dataCollection ?? false)
    }

    const notifications = settings.notifications as Record<string, boolean> | undefined
    if (notifications) {
      setEnableDesktopNotifications(notifications.desktop ?? true)
      setEnableSoundNotifications(notifications.sound ?? true)
      setEnableMessageNotifications(notifications.messages ?? true)
      setEnableMentionNotifications(notifications.mentions ?? true)
      setEnableFriendNotifications(notifications.friends ?? true)
      setFlashTaskbar(notifications.flashTaskbar ?? true)
    }

    const voice = settings.voice as Record<string, unknown> | undefined
    if (voice) {
      setInputVolume((voice.inputVolume as number) ?? 100)
      setOutputVolume((voice.outputVolume as number) ?? 100)
      setNoiseSuppression((voice.noiseSuppression as boolean) ?? true)
      setEchoCancellation((voice.echoCancellation as boolean) ?? true)
      setAutoGainControl((voice.autoGainControl as boolean) ?? true)
      setPushToTalk((voice.pushToTalk as boolean) ?? false)
      setVoiceActivityDetection((voice.voiceActivityDetection as boolean) ?? true)
      setAutoAdjustMic((voice.autoAdjustMic as boolean) ?? true)
      setHardwareMute((voice.hardwareMute as boolean) ?? false)
      setHardwareAcceleration((voice.hardwareAcceleration as boolean) ?? false)
      setVideoQuality((voice.videoQuality as string) ?? "720p")
      setVideoFps((voice.videoFps as string) ?? "30")
      setScreenShareQuality((voice.screenShareQuality as string) ?? "720p")
      setScreenShareFps((voice.screenShareFps as string) ?? "30")
      if (voice.selectedMicId) setSelectedMicId(voice.selectedMicId as string)
      if (voice.selectedSpeakerId) setSelectedSpeakerId(voice.selectedSpeakerId as string)
      if (voice.selectedCameraId) setSelectedCameraId(voice.selectedCameraId as string)
    }
  }, [])

  useEffect(() => {
    if (!visible) {
      return
    }

    const resolvedDisplayName = authUser?.displayName?.trim() || user.nickname
    setDisplayName(resolvedDisplayName)
    setProfileBio(user.bio || "")
    setPronouns(user.pronouns || "")
    setEmail(authUser?.email || "")
    setUsername(authUser?.username || user.username)
  }, [authUser?.displayName, authUser?.email, authUser?.username, user.bio, user.nickname, user.pronouns, user.username, visible])

  // Load audio devices
  const loadDevices = useCallback(async () => {
    try {
      await call.refreshDevices()
    } catch (error) {
      showWarningToast("Could not refresh devices", getErrorMessage(error, "Please try again."))
    }
  }, [call.refreshDevices, getErrorMessage, showWarningToast])

  useEffect(() => {
    const mappedDevices: AudioDevice[] = [
      ...call.audioInputDevices.map((device) => ({
        deviceId: device.id,
        label: device.name,
        kind: "audioinput" as const,
      })),
      ...call.audioOutputDevices.map((device) => ({
        deviceId: device.id,
        label: device.name,
        kind: "audiooutput" as const,
      })),
      ...call.videoInputDevices.map((device) => ({
        deviceId: device.id,
        label: device.name,
        kind: "videoinput" as const,
      })),
    ]

    setAudioDevices(mappedDevices)

    if (!selectedMicId) {
      setSelectedMicId(call.selectedAudioInput || mappedDevices.find((d) => d.kind === "audioinput")?.deviceId || "")
    }
    if (!selectedSpeakerId) {
      setSelectedSpeakerId(call.selectedAudioOutput || mappedDevices.find((d) => d.kind === "audiooutput")?.deviceId || "")
    }
    if (!selectedCameraId) {
      setSelectedCameraId(call.selectedVideoInput || mappedDevices.find((d) => d.kind === "videoinput")?.deviceId || "")
    }
  }, [
    call.audioInputDevices,
    call.audioOutputDevices,
    call.selectedAudioInput,
    call.selectedAudioOutput,
    call.selectedVideoInput,
    call.videoInputDevices,
    selectedCameraId,
    selectedMicId,
    selectedSpeakerId,
  ])

  useEffect(() => {
    if (visible) {
      loadDevices()
    }
  }, [visible, loadDevices])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
      setIsClosing(false)
    }, 200)
  }, [onClose])

  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [visible, handleClose])

  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }

    const timeoutId = setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("mousedown", handleClickOutside)
    }
  }, [visible, handleClose])

  // Load settings from local cache + backend profile/settings
  useEffect(() => {
    if (!visible) {
      return
    }

    const loadSettings = async () => {
      let hasLocalSettings = false

      const savedSettings = localStorage.getItem("astrolune_settings")
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings) as Record<string, unknown>
          applyLocalSettings(settings)
          hasLocalSettings = true
        } catch (e) {
          showWarningToast("Settings were not loaded", getErrorMessage(e, "Some parameters were reset."))
        }
      }

      const savedAccount = localStorage.getItem("astrolune_account")
      if (savedAccount) {
        try {
          const account = JSON.parse(savedAccount) as Record<string, string>
          if (account.phone) {
            setPhone(account.phone)
          }
        } catch (e) {
          showWarningToast("Account cache was not loaded", getErrorMessage(e, "Check local settings data."))
        }
      }

      const profile = await requestUserService<UserProfilePayload>("/me", {
        method: "GET",
      }).catch(() => null)
      if (profile) {
        if (profile.displayName?.trim()) {
          setDisplayName(profile.displayName.trim())
        }
        if (typeof profile.bio === "string") {
          setProfileBio(profile.bio)
        }
      }

      const remoteSettings = await requestUserService<UserSettingsPayload>("/settings", {
        method: "GET",
      }).catch(() => null)
      if (remoteSettings) {
        const remoteSettingsRecord = remoteSettings as Record<string, unknown>
        const remoteNotificationsEnabled = readBoolean(remoteSettingsRecord, "notificationsEnabled")
        const languageFromBackend = normalizeLanguageCode(readString(remoteSettingsRecord, "locale"))

        if (!hasLocalSettings) {
          setEnableDesktopNotifications(remoteNotificationsEnabled)
          setEnableSoundNotifications(remoteNotificationsEnabled)
          setEnableMessageNotifications(remoteNotificationsEnabled)
          setEnableMentionNotifications(remoteNotificationsEnabled)
          setEnableFriendNotifications(remoteNotificationsEnabled)
        }

        setCurrentLanguage(languageFromBackend)
        if (i18n.language !== languageFromBackend) {
          await i18n.changeLanguage(languageFromBackend)
        }
      }
    }

    void loadSettings()
  }, [applyLocalSettings, getErrorMessage, i18n, showWarningToast, visible])

  // Save settings
  const saveSettings = useCallback(async () => {
    const settings = {
      privacy: {
        allowDMs,
        allowFriendRequests,
        showOnlineStatus,
        showActivity,
        allowServerInvites,
        messageScanning,
        dataCollection,
      },
      notifications: {
        desktop: enableDesktopNotifications,
        sound: enableSoundNotifications,
        messages: enableMessageNotifications,
        mentions: enableMentionNotifications,
        friends: enableFriendNotifications,
        flashTaskbar,
      },
      voice: {
        inputVolume,
        outputVolume,
        noiseSuppression,
        echoCancellation,
        autoGainControl,
        pushToTalk,
        voiceActivityDetection,
        autoAdjustMic,
        hardwareMute,
        hardwareAcceleration,
        videoQuality,
        videoFps,
        screenShareQuality,
        screenShareFps,
        selectedMicId,
        selectedSpeakerId,
        selectedCameraId,
      },
      language: currentLanguage,
    }

    localStorage.setItem("astrolune_settings", JSON.stringify(settings))
  }, [
    allowDMs,
    allowFriendRequests,
    showOnlineStatus,
    showActivity,
    allowServerInvites,
    messageScanning,
    dataCollection,
    enableDesktopNotifications,
    enableSoundNotifications,
    enableMessageNotifications,
    enableMentionNotifications,
    enableFriendNotifications,
    flashTaskbar,
    inputVolume,
    outputVolume,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    pushToTalk,
    voiceActivityDetection,
    autoAdjustMic,
    hardwareMute,
    hardwareAcceleration,
    videoQuality,
    videoFps,
    screenShareQuality,
    screenShareFps,
    selectedMicId,
    selectedSpeakerId,
    selectedCameraId,
    currentLanguage,
  ])

  useEffect(() => {
    if (visible) {
      saveSettings()
    }
  }, [saveSettings, visible])

  const syncRemoteSettings = useCallback(async () => {
    const notificationsEnabled =
      enableDesktopNotifications ||
      enableSoundNotifications ||
      enableMessageNotifications ||
      enableMentionNotifications ||
      enableFriendNotifications

    await requestUserService<UserSettingsPayload>("/settings", {
      method: "PUT",
      body: JSON.stringify({
        theme: "dark",
        locale: resolveSettingsLocale(currentLanguage),
        notificationsEnabled,
      }),
    })
  }, [
    currentLanguage,
    enableDesktopNotifications,
    enableFriendNotifications,
    enableMentionNotifications,
    enableMessageNotifications,
    enableSoundNotifications,
  ])

  useEffect(() => {
    if (!visible) {
      return
    }

    const syncHandle = window.setTimeout(() => {
      void syncRemoteSettings().catch(() => {
        // Keep local settings flow working when backend is temporarily unavailable.
      })
    }, 600)

    return () => {
      window.clearTimeout(syncHandle)
    }
  }, [syncRemoteSettings, visible])

  const handleSaveProfile = useCallback(async () => {
    try {
      await requestUserService<UserProfilePayload>("/me", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: displayName.trim() || username,
          bio: profileBio,
        }),
      })

      showSuccessToast("Profile updated", "Changes were saved successfully.")
    } catch (error) {
      showErrorToast("Failed to update profile", getErrorMessage(error, "Please try again."))
    }
  }, [displayName, getErrorMessage, profileBio, showErrorToast, showSuccessToast, username])

  const handleSaveAccount = useCallback(async () => {
    setIsSavingAccount(true)
    try {
      const accountData = { phone }
      localStorage.setItem("astrolune_account", JSON.stringify(accountData))
      showSuccessToast("Account settings saved", "Local account fields were updated.")
    } catch (error) {
      showErrorToast("Failed to save account settings", getErrorMessage(error, "Please verify fields and retry."))
    } finally {
      setIsSavingAccount(false)
    }
  }, [getErrorMessage, phone, showErrorToast, showSuccessToast])

  const handleLanguageChange = useCallback(
    (langCode: string) => {
      setCurrentLanguage(langCode)
      i18n.changeLanguage(langCode)
      localStorage.setItem("astrolune_language", langCode)
    },
    [i18n],
  )

  const handleLogoutAllDevices = useCallback(async () => {
    try {
      await signOut()
      showSuccessToast("Signed out", "Current device session has been closed.")
      handleClose()
    } catch (error) {
      showErrorToast("Sign out failed", getErrorMessage(error, "Could not terminate session."))
    }
  }, [getErrorMessage, handleClose, showErrorToast, showSuccessToast, signOut])

  const handleMicChange = useCallback(async (deviceId: string) => {
    setSelectedMicId(deviceId)
    await call.setAudioDevice(deviceId)
  }, [call])

  const handleSpeakerChange = useCallback(async (deviceId: string) => {
    setSelectedSpeakerId(deviceId)
    await call.setAudioOutputDevice(deviceId)
  }, [call])

  const handleCameraChange = useCallback(async (deviceId: string) => {
    setSelectedCameraId(deviceId)
    await call.setVideoDevice(deviceId)
  }, [call])

  const sectionTitleKeyById: Record<string, string> = {
    profiles: "profiles",
    account: "my_account",
    privacy: "data_privacy",
    notifications: "notifications",
    language: "language",
    voice: "voice_video",
  }

  const currentSectionTitle = t(sectionTitleKeyById[activeSection] ?? "profiles")

  const renderContent = () => {
    switch (activeSection) {
      case "profiles":
        return (
          <ProfileSection
            user={user}
            displayName={displayName}
            pronouns={pronouns}
            onDisplayNameChange={setDisplayName}
            onPronounsChange={setPronouns}
            onSaveProfile={handleSaveProfile}
          />
        )
      case "account":
        return (
          <AccountSection
            email={email}
            username={username}
            phone={phone}
            isSaving={isSavingAccount}
            isIdentityEditable={false}
            onEmailChange={setEmail}
            onUsernameChange={setUsername}
            onPhoneChange={setPhone}
            onSave={handleSaveAccount}
            onLogoutAllDevices={handleLogoutAllDevices}
          />
        )
      case "privacy":
        return (
          <PrivacySection
            allowDMs={allowDMs}
            allowFriendRequests={allowFriendRequests}
            showOnlineStatus={showOnlineStatus}
            showActivity={showActivity}
            allowServerInvites={allowServerInvites}
            messageScanning={messageScanning}
            dataCollection={dataCollection}
            onAllowDMsChange={setAllowDMs}
            onAllowFriendRequestsChange={setAllowFriendRequests}
            onShowOnlineStatusChange={setShowOnlineStatus}
            onShowActivityChange={setShowActivity}
            onAllowServerInvitesChange={setAllowServerInvites}
            onMessageScanningChange={setMessageScanning}
            onDataCollectionChange={setDataCollection}
          />
        )
      case "notifications":
        return (
          <NotificationsSection
            enableDesktopNotifications={enableDesktopNotifications}
            enableSoundNotifications={enableSoundNotifications}
            enableMessageNotifications={enableMessageNotifications}
            enableMentionNotifications={enableMentionNotifications}
            enableFriendNotifications={enableFriendNotifications}
            flashTaskbar={flashTaskbar}
            onDesktopNotificationsChange={setEnableDesktopNotifications}
            onSoundNotificationsChange={setEnableSoundNotifications}
            onMessageNotificationsChange={setEnableMessageNotifications}
            onMentionNotificationsChange={setEnableMentionNotifications}
            onFriendNotificationsChange={setEnableFriendNotifications}
            onFlashTaskbarChange={setFlashTaskbar}
          />
        )
      case "language":
        return <LanguageSection currentLanguage={currentLanguage} onLanguageChange={handleLanguageChange} />
      case "voice":
        return (
          <VoiceVideoSection
            audioDevices={audioDevices}
            selectedMicId={selectedMicId}
            selectedSpeakerId={selectedSpeakerId}
            selectedCameraId={selectedCameraId}
            onMicChange={handleMicChange}
            onSpeakerChange={handleSpeakerChange}
            onCameraChange={handleCameraChange}
            onRefreshDevices={loadDevices}
            inputVolume={inputVolume}
            outputVolume={outputVolume}
            onInputVolumeChange={setInputVolume}
            onOutputVolumeChange={setOutputVolume}
            noiseSuppression={noiseSuppression}
            echoCancellation={echoCancellation}
            autoGainControl={autoGainControl}
            voiceActivityDetection={voiceActivityDetection}
            hardwareMute={hardwareMute}
            autoAdjustMic={autoAdjustMic}
            pushToTalk={pushToTalk}
            onNoiseSuppressionChange={setNoiseSuppression}
            onEchoCancellationChange={setEchoCancellation}
            onAutoGainControlChange={setAutoGainControl}
            onVoiceActivityDetectionChange={setVoiceActivityDetection}
            onHardwareMuteChange={setHardwareMute}
            onAutoAdjustMicChange={setAutoAdjustMic}
            onPushToTalkChange={setPushToTalk}
            videoQuality={videoQuality}
            videoFps={videoFps}
            screenShareQuality={screenShareQuality}
            screenShareFps={screenShareFps}
            hardwareAcceleration={hardwareAcceleration}
            onVideoQualityChange={setVideoQuality}
            onVideoFpsChange={setVideoFps}
            onScreenShareQualityChange={setScreenShareQuality}
            onScreenShareFpsChange={setScreenShareFps}
            onHardwareAccelerationChange={setHardwareAcceleration}
          />
        )
      default:
        return null
    }
  }

  if (!visible) return null

  return createPortal(
    <Backdrop visible={visible}>
      <div ref={modalRef} className={cn("settings-modal", { "settings-modal--closing": isClosing })}>
        <aside className="settings-sidebar">
          <div className="settings-sidebar__header">
            <button className="settings-sidebar__user" onClick={() => setActiveSection("profiles")}>
              <Avatar src={user.avatar.src} alt={user.nickname} size={40} />
              <div className="settings-sidebar__user-info">
                <div className="settings-sidebar__user-name">{user.nickname}</div>
                <div className="settings-sidebar__user-action">
                  <Pencil size={12} />
                  {t("edit_profile")}
                </div>
              </div>
            </button>
          </div>

          <div className="settings-sidebar__search">
            <TextField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search")}
              theme="dark"
            />
          </div>

          <nav className="settings-sidebar__nav">
            {SETTINGS_CATEGORIES.map((category) => (
              <div key={category.title} className="settings-sidebar__category">
                <div className="settings-sidebar__category-title">{t(category.title)}</div>
                {category.items.map((item) => (
                  <button
                    key={item.id}
                    className={cn("settings-sidebar__nav-item", {
                      "settings-sidebar__nav-item--active": activeSection === item.id,
                    })}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {item.icon}
                    <span>{t(item.label)}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <section className="settings-content">
          <header className="settings-content__header">
            <h2 className="settings-content__title">{currentSectionTitle}</h2>
            <button className="settings-content__close" onClick={handleClose} aria-label="Close settings">
              <X size={18} />
            </button>
          </header>

          <div className="settings-content__body">{renderContent()}</div>
        </section>
      </div>
    </Backdrop>,
    document.body,
  )
}
