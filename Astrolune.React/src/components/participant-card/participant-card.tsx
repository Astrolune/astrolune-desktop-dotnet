"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import { Mic, MicOff, Maximize2, Pin, MoreHorizontal } from "lucide-react"
import { Avatar } from "../avatar/avatar"
import cn from "classnames"
import "./participant-card.scss"

export interface ParticipantData {
  id: string
  name: string
  avatar?: string
  isSpeaking: boolean
  isMuted: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  videoTrack?:
    | MediaStreamTrack
    | {
        mediaStreamTrack?: MediaStreamTrack
        attach?: (element?: HTMLMediaElement) => HTMLMediaElement | HTMLMediaElement[]
        detach?: (element?: HTMLMediaElement) => HTMLMediaElement[]
      }
    | null
  previewThumbnail?: string | null
  audioLevel?: number
}

interface ParticipantCardProps {
  participant: ParticipantData
  isLocal?: boolean
  isExpanded?: boolean
  isPinned?: boolean
  onExpand?: (id: string) => void
  onPin?: (id: string) => void
  size?: "small" | "medium" | "large"
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isLocal = false,
  isExpanded = false,
  isPinned = false,
  onExpand,
  onPin,
  size = "medium",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showControls, setShowControls] = useState(false)

  useEffect(() => {
    const videoElement = videoRef.current
    const track = participant.videoTrack
    if (!videoElement || !track) {
      if (videoElement) {
        videoElement.srcObject = null
      }
      return
    }

    if (typeof (track as { attach?: unknown }).attach === "function") {
      const attachTrack = track as {
        attach: (element?: HTMLMediaElement) => HTMLMediaElement | HTMLMediaElement[]
        detach?: (element?: HTMLMediaElement) => HTMLMediaElement[]
      }
      attachTrack.attach(videoElement)
      return () => {
        attachTrack.detach?.(videoElement)
      }
    }

    if (track instanceof MediaStreamTrack) {
      const stream = new MediaStream([track])
      videoElement.srcObject = stream
      return () => {
        videoElement.srcObject = null
      }
    }

    const mediaStreamTrack = track.mediaStreamTrack
    if (mediaStreamTrack) {
      const stream = new MediaStream([mediaStreamTrack])
      videoElement.srcObject = stream
      return () => {
        videoElement.srcObject = null
      }
    }

    videoElement.srcObject = null
  }, [participant.videoTrack])

  const handleExpand = useCallback(() => {
    onExpand?.(participant.id)
  }, [participant.id, onExpand])

  const handlePin = useCallback(() => {
    onPin?.(participant.id)
  }, [participant.id, onPin])

  return (
    <div
      className={cn("participant-card", `participant-card--${size}`, {
        "participant-card--speaking": participant.isSpeaking,
        "participant-card--expanded": isExpanded,
        "participant-card--pinned": isPinned,
        "participant-card--local": isLocal,
      })}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {participant.videoTrack ? (
        <video ref={videoRef} className="participant-card__video" autoPlay playsInline muted={isLocal} />
      ) : participant.isScreenSharing && participant.previewThumbnail ? (
        <img
          className="participant-card__video participant-card__video-preview"
          src={
            participant.previewThumbnail.startsWith("data:")
              ? participant.previewThumbnail
              : `data:image/png;base64,${participant.previewThumbnail}`
          }
          alt={`${participant.name} screen preview`}
        />
      ) : participant.isCameraOn || participant.isScreenSharing ? (
        <video ref={videoRef} className="participant-card__video" autoPlay playsInline muted={isLocal} />
      ) : (
        <div className="participant-card__avatar-container">
          <Avatar
            size={size === "small" ? 48 : size === "medium" ? 72 : 96}
            src={participant.avatar}
            alt={participant.name}
          />
        </div>
      )}

      <div className="participant-card__info">
        <div className="participant-card__name">
          {participant.name}
          {isLocal && <span className="participant-card__you">(You)</span>}
        </div>
        <div className="participant-card__status">
          {participant.isMuted ? (
            <MicOff size={14} className="participant-card__muted-icon" />
          ) : (
            <Mic
              size={14}
              className={cn("participant-card__mic-icon", {
                "participant-card__mic-icon--speaking": participant.isSpeaking,
              })}
            />
          )}
        </div>
      </div>

      {participant.isSpeaking && (
        <div className="participant-card__speaking-indicator">
          <div className="participant-card__speaking-bar" />
          <div className="participant-card__speaking-bar" />
          <div className="participant-card__speaking-bar" />
        </div>
      )}

      {showControls && (
        <div className="participant-card__controls">
          {onExpand && (
            <button className="participant-card__control-button" onClick={handleExpand} title="Expand">
              <Maximize2 size={16} />
            </button>
          )}
          {onPin && (
            <button
              className={cn("participant-card__control-button", {
                "participant-card__control-button--active": isPinned,
              })}
              onClick={handlePin}
              title={isPinned ? "Unpin" : "Pin"}
            >
              <Pin size={16} />
            </button>
          )}
          <button className="participant-card__control-button" title="More">
            <MoreHorizontal size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export default ParticipantCard
