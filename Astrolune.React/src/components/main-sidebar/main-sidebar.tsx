"use client"

import type React from "react"
import { useRef, useEffect, useState, useCallback } from "react"
import { Avatar } from "../avatar/avatar"
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  X,
  Plus,
  Search,
  Users,
} from "lucide-react"
import { DeviceContextMenu, type AudioDevice } from "../device-context-menu/device-context-menu"
import { CommandMenu } from "../command-menu/command-menu"
import { useCall } from "../../contexts/call-context"
import type { Chat, User, UserData } from "../../types"
import "./main-sidebar.scss"
import cn from "classnames"
import { GearIcon } from "@primer/octicons-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ProfileCard } from "../profile-card/profile-card"
import { createPortal } from "react-dom";

const SIDEBAR_MIN_WIDTH = 240
const SIDEBAR_INITIAL_WIDTH = 309
const SIDEBAR_MAX_WIDTH = 420

const getInitialSidebarWidth = (): number => {
  if (typeof window === "undefined") return SIDEBAR_INITIAL_WIDTH
  const stored = window.localStorage.getItem("sidebarWidth")
  return stored ? Number(stored) : SIDEBAR_INITIAL_WIDTH
}

interface MainSidebarProps {
  chats: Chat[]
  user: User
  profileUser: UserData
  onOpenSettings?: () => void
  onOpenFriends?: () => void
}

export const MainSidebar: React.FC<MainSidebarProps> = ({
  chats,
  user,
  profileUser,
  onOpenSettings,
  onOpenFriends,
}) => {
  const [isResizing, setIsResizing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth)
  const [showCommandMenu, setShowCommandMenu] = useState(false)

  const call = useCall()

  const [localMuted, setLocalMuted] = useState(false)
  const [localDeafened, setLocalDeafened] = useState(false)

  const isMuted = call.isConnected ? call.isMuted : localMuted
  const isDeafened = call.isConnected ? call.isDeafened : localDeafened

  const [micContextMenu, setMicContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [speakerContextMenu, setSpeakerContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [micVolume, setMicVolume] = useState(100)
  const [speakerVolume, setSpeakerVolume] = useState(100)

  const sidebarRef = useRef<HTMLElement>(null)
  const cursorPos = useRef({ x: 0 })
  const sidebarInitialWidth = useRef(0)

  const [showProfilePreview, setShowProfilePreview] = useState(false);
  const profileBtnRef = useRef<HTMLButtonElement>(null);

  const { t } = useTranslation(["sidebar", "call", "settings"])
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showProfilePreview &&
        profileBtnRef.current && 
        !profileBtnRef.current.contains(e.target as Node)
      ) {
        setShowProfilePreview(false);
      }
    };

    if (showProfilePreview) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfilePreview]);

  const handleMouseDown: React.MouseEventHandler<HTMLButtonElement> = useCallback((event) => {
    setIsResizing(true)
    cursorPos.current.x = event.clientX
    sidebarInitialWidth.current = sidebarRef.current?.clientWidth || SIDEBAR_INITIAL_WIDTH
  }, [])

  const handleMicClick = useCallback(() => {
    setLocalMuted((prev) => !prev)
  }, [])

  const handleMicContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMicContextMenu({ x: rect.left, y: rect.top - 8 })
    setSpeakerContextMenu(null)
  }, [])

  const handleSpeakerClick = useCallback(() => {
    setLocalDeafened((prev) => !prev)
  }, [])

  const handleSpeakerContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setSpeakerContextMenu({ x: rect.left, y: rect.top - 8 })
    setMicContextMenu(null)
  }, [])

  const handleOpenFriends = useCallback(() => {
    onOpenFriends?.()
    navigate("/friends")
  }, [navigate, onOpenFriends])


  const handleChatClick = useCallback(
    (chatId: string) => {
      navigate(`/chat/${chatId}`)
    },
    [navigate],
  )

  const handleMicSelect = useCallback(
    (deviceId: string) => {
      void call.setAudioDevice(deviceId)
    },
    [call],
  )

  const handleSpeakerSelect = useCallback(
    (deviceId: string) => {
      void call.setAudioOutputDevice(deviceId)
    },
    [call],
  )

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (event: MouseEvent) => {
      const cursorXDelta = event.clientX - cursorPos.current.x

      const newWidth = Math.max(
        SIDEBAR_MIN_WIDTH,
        Math.min(sidebarInitialWidth.current + cursorXDelta, SIDEBAR_MAX_WIDTH),
      )

      setSidebarWidth(newWidth)
      window.localStorage.setItem("sidebarWidth", String(newWidth))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing])

  const micDevices: AudioDevice[] = call.audioInputDevices.map((device) => ({
    deviceId: device.id,
    label: device.name,
    kind: "audioinput",
  }))
  const speakerDevices: AudioDevice[] = call.audioOutputDevices.map((device) => ({
    deviceId: device.id,
    label: device.name,
    kind: "audiooutput",
  }))
  const selectedMicId = call.selectedAudioInput
  const selectedSpeakerId = call.selectedAudioOutput

  return (
    <aside
      ref={sidebarRef}
      className={cn("sidebar", { "sidebar--resizing": isResizing })}
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        maxWidth: sidebarWidth,
      }}
    >
      <div className="sidebar__container">
        <div className="top-buttons">
          <button className="search-button" onClick={() => setShowCommandMenu(true)}>
            <Search size={16} />
            <span className="search-button-text">{t("sidebar:search")}</span>
          </button>

          <button className="header-item header-item--friends" onClick={handleOpenFriends}>
            <Users size={20} />
            <span className="text-header-item">{t("sidebar:friends")}</span>
          </button>

        </div>

        <section className="section">
          <div className="chat-header">
            <small className="section-title">{t("sidebar:chats")}</small>
            <button className="top-button" onClick={(e) => e.stopPropagation()}>
              <Plus size={16} />
            </button>
          </div>

          <div className="chats">
            {chats.map((chat) => (
              <button key={chat.id} className="chat-item" onClick={() => handleChatClick(chat.id)}>
                <Avatar size={36} src={chat.avatar} alt={chat.name} />
                <div className="chat-info">
                  <div className="chat-name">{chat.name}</div>
                  <div className="chat-status">{chat.status}</div>
                </div>
                <span className="chat-close-button" onClick={(e) => e.stopPropagation()}>
                  <X size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="user-section">
          <button className="user-info" ref={profileBtnRef} onClick={() => setShowProfilePreview(!showProfilePreview)}>
            <Avatar size={32} src={user.avatar} alt={user.name} />
            <div className="user-details">
              <div className="user-name">{user.name}</div>
              <div className="user-status">
                {call.isConnected ? (
                  <span className="user-status--in-call">
                    {t("call:speaking")} - {call.roomName}
                  </span>
                ) : (
                  user.status
                )}
              </div>
            </div>
          </button>
          <div className="user-controls">
            <button
              className={cn("control-button", { "control-button--muted": isMuted })}
              onClick={handleMicClick}
              onContextMenu={handleMicContextMenu}
              title={isMuted ? t("call:unmute") : t("call:mute")}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              className={cn("control-button", { "control-button--deafened": isDeafened })}
              onClick={handleSpeakerClick}
              onContextMenu={handleSpeakerContextMenu}
              title={isDeafened ? t("call:undeafen") : t("call:deafen")}
            >
              {isDeafened ? <VolumeX size={18} /> : <Headphones size={18} />}
            </button>
            <button className="control-button" onClick={onOpenSettings}>
              <GearIcon size={18} />
            </button>
          </div>
        </section>
      </div>

      <button type="button" className="sidebar__handle" onMouseDown={handleMouseDown} />

      <CommandMenu isOpen={showCommandMenu} onClose={() => setShowCommandMenu(false)} />

      {showProfilePreview && createPortal(
        <div 
          className="profile-card-popover" 
          style={{
            position: 'fixed',
            bottom: '80px', 
            left: '20px', 
            zIndex: 9999
          }}
        >
          <ProfileCard
            user={profileUser}
            displayName={profileUser.nickname}
            pronouns={profileUser.pronouns ?? ""}
          />
        </div>,
        document.body 
      )}

      <DeviceContextMenu
        isOpen={!!micContextMenu}
        position={micContextMenu || { x: 0, y: 0 }}
        onClose={() => setMicContextMenu(null)}
        type="microphone"
        inputDevices={micDevices}
        outputDevices={speakerDevices}
        selectedInputDeviceId={selectedMicId}
        selectedOutputDeviceId={selectedSpeakerId}
        volume={micVolume}
        onInputDeviceSelect={handleMicSelect}
        onOutputDeviceSelect={handleSpeakerSelect}
        onVolumeChange={setMicVolume}
        onOpenSettings={() => {
          setMicContextMenu(null)
          onOpenSettings?.()
        }}
      />

      <DeviceContextMenu
        isOpen={!!speakerContextMenu}
        position={speakerContextMenu || { x: 0, y: 0 }}
        onClose={() => setSpeakerContextMenu(null)}
        type="speaker"
        inputDevices={micDevices}
        outputDevices={speakerDevices}
        selectedInputDeviceId={selectedMicId}
        selectedOutputDeviceId={selectedSpeakerId}
        volume={speakerVolume}
        onInputDeviceSelect={handleMicSelect}
        onOutputDeviceSelect={handleSpeakerSelect}
        onVolumeChange={setSpeakerVolume}
        onOpenSettings={() => {
          setSpeakerContextMenu(null)
          onOpenSettings?.()
        }}
      />
    </aside>
  )
}

export default MainSidebar
