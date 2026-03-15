"use client"

import type React from "react"
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Volume2, VolumeX, ChevronDown, Phone } from "lucide-react"
import cn from "classnames"
import "./call-header-panel.scss"

interface CallHeaderPanelProps {
  isInCall: boolean
  isMuted: boolean
  isDeafened: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  callDuration: number
  roomName?: string
  onMuteToggle: () => void
  onDeafenToggle: () => void
  onCameraToggle: () => void
  onScreenShareToggle: () => void
  onLeaveCall: () => void
  onExpandCall?: () => void
}

export const CallHeaderPanel: React.FC<CallHeaderPanelProps> = ({
  isInCall,
  isMuted,
  isDeafened,
  isCameraOn,
  isScreenSharing,
  callDuration,
  roomName,
  onMuteToggle,
  onDeafenToggle,
  onCameraToggle,
  onScreenShareToggle,
  onLeaveCall,
  onExpandCall,
}) => {
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (!isInCall) return null

  return (
    <div className="call-header-panel">
      <div className="call-header-panel__info" onClick={onExpandCall}>
        <div className="call-header-panel__status">
          <Phone size={14} className="call-header-panel__phone-icon" />
          <span className="call-header-panel__duration">{formatDuration(callDuration)}</span>
        </div>
        {roomName && <span className="call-header-panel__room">{roomName}</span>}
        {onExpandCall && <ChevronDown size={14} className="call-header-panel__expand" />}
      </div>

      <div className="call-header-panel__controls">
        <button
          className={cn("call-header-panel__button", { "call-header-panel__button--active": isMuted })}
          onClick={onMuteToggle}
          title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        <button
          className={cn("call-header-panel__button", { "call-header-panel__button--active": isDeafened })}
          onClick={onDeafenToggle}
          title={isDeafened ? "Включить звук" : "Выключить звук"}
        >
          {isDeafened ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        <button
          className={cn("call-header-panel__button", { "call-header-panel__button--enabled": isCameraOn })}
          onClick={onCameraToggle}
          title={isCameraOn ? "Выключить камеру" : "Включить камеру"}
        >
          {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
        </button>

        <button
          className={cn("call-header-panel__button", { "call-header-panel__button--enabled": isScreenSharing })}
          onClick={onScreenShareToggle}
          title={isScreenSharing ? "Остановить демонстрацию" : "Демонстрация экрана"}
        >
          <Monitor size={16} />
        </button>

        <button
          className="call-header-panel__button call-header-panel__button--danger"
          onClick={onLeaveCall}
          title="Отключиться"
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  )
}

export default CallHeaderPanel
