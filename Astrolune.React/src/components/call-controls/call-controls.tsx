"use client"

import type React from "react"
import { useState, useCallback } from "react"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Users,
  Volume2,
  VolumeX,
  Maximize2,
  MessageSquare,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import "./call-controls.scss"

export interface CallControlsProps {
  isMuted: boolean
  isDeafened: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  screenShareDisabled?: boolean
  screenShareDisabledReason?: string | null
  isInCall: boolean
  participantCount?: number
  onMuteToggle: () => void
  onDeafenToggle: () => void
  onCameraToggle: () => void
  onScreenShareToggle: () => void
  onLeaveCall: () => void
  onSettingsOpen?: () => void
  onFullscreenToggle?: () => void
  onChatToggle?: () => void
  showParticipants?: boolean
  showChatButton?: boolean
  isChatOpen?: boolean
  compact?: boolean
  isHidden?: boolean
}

export const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isDeafened,
  isCameraOn,
  isScreenSharing,
  screenShareDisabled = false,
  screenShareDisabledReason = null,
  isInCall,
  participantCount = 0,
  onMuteToggle,
  onDeafenToggle,
  onCameraToggle,
  onScreenShareToggle,
  onLeaveCall,
  onFullscreenToggle,
  onChatToggle,
  showParticipants = true,
  showChatButton = false,
  isChatOpen = false,
  compact = false,
  isHidden = false,
}) => {
  const { t } = useTranslation("call")
  const [showTooltip, setShowTooltip] = useState<string | null>(null)

  const handleTooltip = useCallback((id: string | null) => {
    setShowTooltip(id)
  }, [])

  if (!isInCall) return null

  return (
    <div
      className={cn("call-controls", {
        "call-controls--compact": compact,
        "call-controls--hidden": isHidden,
      })}
    >
      <div className="call-controls__left">
        {showParticipants && (
          <div className="call-controls__participants">
            <Users size={16} />
            <span>{participantCount}</span>
          </div>
        )}
      </div>

      <div className="call-controls__center">
        <button
          className={cn("call-controls__button", { "call-controls__button--active": isMuted })}
          onClick={onMuteToggle}
          onMouseEnter={() => handleTooltip("mic")}
          onMouseLeave={() => handleTooltip(null)}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          {showTooltip === "mic" && (
            <span className="call-controls__tooltip">{isMuted ? t("unmute") : t("mute")}</span>
          )}
        </button>

        <button
          className={cn("call-controls__button", { "call-controls__button--active": isDeafened })}
          onClick={onDeafenToggle}
          onMouseEnter={() => handleTooltip("deafen")}
          onMouseLeave={() => handleTooltip(null)}
        >
          {isDeafened ? <VolumeX size={20} /> : <Volume2 size={20} />}
          {showTooltip === "deafen" && (
            <span className="call-controls__tooltip">{isDeafened ? t("undeafen") : t("deafen")}</span>
          )}
        </button>

        <button
          className={cn("call-controls__button", { "call-controls__button--enabled": isCameraOn })}
          onClick={onCameraToggle}
          onMouseEnter={() => handleTooltip("camera")}
          onMouseLeave={() => handleTooltip(null)}
        >
          {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
          {showTooltip === "camera" && (
            <span className="call-controls__tooltip">{isCameraOn ? t("camera_off") : t("camera_on")}</span>
          )}
        </button>

        <button
          className={cn("call-controls__button", { "call-controls__button--enabled": isScreenSharing })}
          onClick={onScreenShareToggle}
          disabled={screenShareDisabled}
          title={screenShareDisabledReason ?? undefined}
          onMouseEnter={() => handleTooltip("screen")}
          onMouseLeave={() => handleTooltip(null)}
        >
          <Monitor size={20} />
          {showTooltip === "screen" && (
            <span className="call-controls__tooltip">
              {screenShareDisabledReason
                ? screenShareDisabledReason
                : isScreenSharing
                  ? t("stop_screen_share")
                  : t("screen_share")}
            </span>
          )}
        </button>

        <button
          className="call-controls__button call-controls__button--danger"
          onClick={onLeaveCall}
          onMouseEnter={() => handleTooltip("leave")}
          onMouseLeave={() => handleTooltip(null)}
        >
          <PhoneOff size={20} />
          {showTooltip === "leave" && <span className="call-controls__tooltip">{t("leave_call")}</span>}
        </button>
      </div>

      <div className="call-controls__right">
        {showChatButton && onChatToggle && (
          <button
            className={cn("call-controls__button call-controls__button--secondary", {
              "call-controls__button--enabled": isChatOpen,
            })}
            onClick={onChatToggle}
            onMouseEnter={() => handleTooltip("chat")}
            onMouseLeave={() => handleTooltip(null)}
          >
            <MessageSquare size={18} />
            {showTooltip === "chat" && <span className="call-controls__tooltip">{t("chat") || "Chat"}</span>}
          </button>
        )}

        {onFullscreenToggle && (
          <button
            className="call-controls__button call-controls__button--secondary"
            onClick={onFullscreenToggle}
            onMouseEnter={() => handleTooltip("fullscreen")}
            onMouseLeave={() => handleTooltip(null)}
          >
            <Maximize2 size={18} />
            {showTooltip === "fullscreen" && <span className="call-controls__tooltip">{t("fullscreen")}</span>}
          </button>
        )}
      </div>
    </div>
  )
}

export default CallControls
