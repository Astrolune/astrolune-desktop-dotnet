"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Maximize2,
} from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { ParticipantCard, type ParticipantData } from "../participant-card/participant-card"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import "./in-call-panel.scss"

interface InCallPanelProps {
  isInCall: boolean
  isMuted: boolean
  isDeafened: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  callDuration: number
  roomName?: string
  participants: ParticipantData[]
  onMuteToggle: () => void
  onDeafenToggle: () => void
  onCameraToggle: () => void
  onScreenShareToggle: () => void
  onLeaveCall: () => void
  onExpandCall?: () => void
}

const MIN_HEIGHT = 60
const MAX_HEIGHT = 400
const COLLAPSED_HEIGHT = 60
const RESIZE_GRAB_ZONE_PX = 8

export const InCallPanel: React.FC<InCallPanelProps> = ({
  isInCall,
  isMuted,
  isDeafened,
  isCameraOn,
  isScreenSharing,
  callDuration,
  roomName,
  participants,
  onMuteToggle,
  onDeafenToggle,
  onCameraToggle,
  onScreenShareToggle,
  onLeaveCall,
  onExpandCall,
}) => {
  const { t } = useTranslation("chat")
  const [height, setHeight] = useState(COLLAPSED_HEIGHT)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizeZoneHovered, setIsResizeZoneHovered] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number>(0)
  const dragStartHeight = useRef<number>(0)

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const isBottomResizeZone = useCallback((e: React.MouseEvent<HTMLDivElement>): boolean => {
    const rect = e.currentTarget.getBoundingClientRect()
    return rect.bottom - e.clientY <= RESIZE_GRAB_ZONE_PX
  }, [])

  const handleControlsMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isBottomResizeZone(e)) return
      e.preventDefault()
      setIsDragging(true)
      dragStartY.current = e.clientY
      dragStartHeight.current = height
    },
    [height, isBottomResizeZone],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      const deltaY = e.clientY - dragStartY.current
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartHeight.current + deltaY))

      setHeight(newHeight)
      setIsCollapsed(newHeight <= COLLAPSED_HEIGHT + 10)
    },
    [isDragging],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleControlsMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizeZoneHovered(isBottomResizeZone(e))
  }, [isBottomResizeZone])

  const handleControlsMouseLeave = useCallback(() => {
    setIsResizeZoneHovered(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const toggleCollapse = useCallback(() => {
    if (isCollapsed) {
      setHeight(250)
      setIsCollapsed(false)
    } else {
      setHeight(COLLAPSED_HEIGHT)
      setIsCollapsed(true)
    }
  }, [isCollapsed])

  if (!isInCall) return null

  return (
    <div
      ref={panelRef}
      className={cn("in-call-panel", {
        "in-call-panel--collapsed": isCollapsed,
        "in-call-panel--dragging": isDragging,
        "in-call-panel__controls--resize-ready": isResizeZoneHovered,
      })}
      onMouseDown={handleControlsMouseDown}
      onMouseMove={handleControlsMouseMove}
      onMouseLeave={handleControlsMouseLeave}
      style={{ height: `${height}px` }}
    >
      <div className="in-call-panel__header">
        <div className="in-call-panel__info">
          <div className="in-call-panel__status">
            <div className="in-call-panel__indicator" />
            <span className="in-call-panel__duration">{formatDuration(callDuration)}</span>
          </div>
          {roomName && <span className="in-call-panel__room">{roomName}</span>}
        </div>

        <div className="in-call-panel__header-controls">
          <button
            className="in-call-panel__header-button"
            onClick={toggleCollapse}
            title={isCollapsed ? t("expand") : t("collapse")}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {onExpandCall && (
            <button className="in-call-panel__header-button" onClick={onExpandCall} title={t("expand_to_full_call")}>
              <Maximize2 size={16} />
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="in-call-panel__participants">
          {participants.map((participant) => (
            <div key={participant.id} className="in-call-panel__participant">
              {height > 150 ? (
                <ParticipantCard participant={participant} isLocal={participant.id === "current-user"} size="small" />
              ) : (
                <div className="in-call-panel__avatar-wrapper">
                  <Avatar size={40} src={participant.avatar} alt={participant.name} />
                  {participant.isSpeaking && <div className="in-call-panel__speaking-ring" />}
                  {participant.isMuted && (
                    <div className="in-call-panel__status-badge">
                      <MicOff size={12} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="in-call-panel__controls">
        <button
          className={cn("in-call-panel__button", { "in-call-panel__button--danger": isMuted })}
          onClick={onMuteToggle}
          title={isMuted ? t("unmute") : t("mute")}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          className={cn("in-call-panel__button", { "in-call-panel__button--danger": isDeafened })}
          onClick={onDeafenToggle}
          title={isDeafened ? t("undeafen") : t("deafen")}
        >
          {isDeafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <button
          className={cn("in-call-panel__button", { "in-call-panel__button--active": isCameraOn })}
          onClick={onCameraToggle}
          title={isCameraOn ? t("turn_off_camera") : t("turn_on_camera")}
        >
          {isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>

        <button
          className={cn("in-call-panel__button", { "in-call-panel__button--active": isScreenSharing })}
          onClick={onScreenShareToggle}
          title={isScreenSharing ? t("stop_screen_share") : t("screen_share")}
        >
          <Monitor size={18} />
        </button>

        <button
          className="in-call-panel__button in-call-panel__button--danger"
          onClick={onLeaveCall}
          title={t("leave_call")}
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  )
}

export default InCallPanel
