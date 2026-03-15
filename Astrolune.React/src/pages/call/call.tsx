"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Video, Users, ArrowLeft, Copy, Check, Wifi, WifiOff, Loader2, AlertCircle } from "lucide-react"
import { useCall } from "../../contexts/call-context"
import { CallControls } from "../../components/call-controls/call-controls"
import { ParticipantCard } from "../../components/participant-card/participant-card"
import { LiveKitAudio } from "../../components/livekit-audio/livekit-audio"
import {
  ScreenSharePicker,
  type ScreenShareSelection,
} from "../../components/screen-share-picker/screen-share-picker"
import { TextField } from "../../components/text-field/text-field"
import { Button } from "../../components/button/button"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { useToast } from "../../hooks/useToast"
import "./call.scss"

const CONTROLS_HIDE_TIMEOUT = 3000
const SHOW_DEV_SHARE_STATS = import.meta.env.DEV

export const CallPage: React.FC = () => {
  const navigate = useNavigate()
  const { roomId } = useParams()
  const { t } = useTranslation("call")
  const {
    isConnected,
    isConnecting,
    connectionState,
    error,
    participants,
    participantCount,
    isMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    screenShareAvailable,
    screenShareUnavailableReason,
    screenShareStats,
    roomName: connectedRoomName,
    connect,
    disconnect,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    toggleDeafen,
  } = useCall()
  const { showErrorToast } = useToast()

  const [isInLobby, setIsInLobby] = useState(!roomId || !isConnected)
  const [roomName, setRoomName] = useState(roomId || "")
  const [nickname, setNickname] = useState("")
  const [copied, setCopied] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [showScreenSharePicker, setShowScreenSharePicker] = useState(false)

  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null)
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsHidden, setControlsHidden] = useState(false)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  const resetHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }
    setControlsHidden(false)

    if (isFullscreen) {
      hideTimeoutRef.current = setTimeout(() => {
        setControlsHidden(true)
      }, CONTROLS_HIDE_TIMEOUT)
    }
  }, [isFullscreen])

  useEffect(() => {
    if (isFullscreen) {
      resetHideTimer()
    } else {
      setControlsHidden(false)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [isFullscreen, resetHideTimer])

  const handleMouseMove = useCallback(() => {
    if (isFullscreen) {
      resetHideTimer()
    }
  }, [isFullscreen, resetHideTimer])

  const handleJoinRoom = useCallback(async () => {
    if (!roomName.trim() || !nickname.trim()) return

    setLocalError(null)

    try {
      // Connect through LiveKit using backend-issued access token.
      await connect(roomName.trim(), `user_${Date.now()}`, nickname.trim())
      setIsInLobby(false)
      navigate(`/call/${roomName.trim()}`, { replace: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect"
      setLocalError(errorMessage)
    }
  }, [roomName, nickname, connect, navigate])

  const handleLeaveCall = useCallback(async () => {
    await disconnect()
    setIsInLobby(true)
    setExpandedParticipant(null)
    setPinnedParticipant(null)
    navigate("/call")
  }, [disconnect, navigate])

  const handleCopyLink = useCallback(async () => {
    const link = `${window.location.origin}/#/call/${connectedRoomName || roomName}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [connectedRoomName, roomName])

  const handleExpandParticipant = useCallback((id: string) => {
    setExpandedParticipant((prev) => (prev === id ? null : id))
  }, [])

  const handlePinParticipant = useCallback((id: string) => {
    setPinnedParticipant((prev) => (prev === id ? null : id))
  }, [])

  const handleFullscreenToggle = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const handleBackToChats = useCallback(() => {
    if (isConnected) {
      disconnect()
    }
    navigate("/")
  }, [navigate, isConnected, disconnect])

  const handleScreenShareToggle = useCallback(() => {
    if (isScreenSharing) {
      void toggleScreenShare()
    } else {
      if (!screenShareAvailable) {
        showErrorToast(t("screen_share"), screenShareUnavailableReason || "Screen share is unavailable")
        return
      }
      setShowScreenSharePicker(true)
    }
  }, [isScreenSharing, screenShareAvailable, screenShareUnavailableReason, showErrorToast, t, toggleScreenShare])

  const handleScreenShareSelect = useCallback(
    async (selection: ScreenShareSelection) => {
      try {
        await toggleScreenShare(
          selection.sourceId,
          selection.settings,
          selection.previewThumbnail,
        )
        setShowScreenSharePicker(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start screen share"
        showErrorToast(t("screen_share"), message)
      }
    },
    [showErrorToast, t, toggleScreenShare],
  )

  const getGridClass = useCallback(() => {
    const count = participants.length
    if (expandedParticipant) return "call-grid--has-expanded"
    if (count === 1) return "call-grid--single"
    if (count === 2) return "call-grid--2"
    if (count <= 4) return "call-grid--4"
    if (count <= 6) return "call-grid--6"
    if (count <= 9) return "call-grid--9"
    return "call-grid--many"
  }, [participants.length, expandedParticipant])

  const getConnectionStatus = useCallback(() => {
    switch (connectionState) {
      case "connected":
        return { icon: Wifi, text: t("speaking"), color: "green" }
      case "connecting":
        return { icon: Loader2, text: t("connecting"), color: "blue" }
      case "reconnecting":
        return { icon: Loader2, text: t("connecting"), color: "yellow" }
      case "disconnected":
      default:
        return { icon: WifiOff, text: t("leave_call"), color: "red" }
    }
  }, [connectionState, t])

  const qualityLabel = useCallback((value: string | null | undefined) => {
    switch (value) {
      case "excellent":
        return "Excellent"
      case "good":
        return "Good"
      case "fair":
        return "Fair"
      case "poor":
        return "Poor"
      default:
        return "Collecting"
    }
  }, [])

  const formatNumber = useCallback((value: number | null, digits = 1) => {
    if (value === null || Number.isNaN(value) || !Number.isFinite(value)) {
      return "-"
    }
    return value.toFixed(digits)
  }, [])

  const formatKbps = useCallback((value: number | null) => {
    if (value === null || Number.isNaN(value) || !Number.isFinite(value)) {
      return "-"
    }
    return value >= 1000 ? `${(value / 1000).toFixed(1)} Mbps` : `${value.toFixed(0)} kbps`
  }, [])

  if (isInLobby || !isConnected) {
    const displayError = localError || error

    return (
      <div className="call-page call-page--lobby">
        <div className="call-lobby">
          <div className="call-lobby__header">
            <button className="call-lobby__back" onClick={handleBackToChats}>
              <ArrowLeft size={20} />
            </button>
            <h1 className="call-lobby__title">
              <Video size={28} />
              {t("start_call")}
            </h1>
          </div>

          <div className="call-lobby__content">
            <div className="call-lobby__form">
              <div className="call-lobby__decoration call-lobby__decoration--top">
                <div className="call-lobby__glow" />
              </div>

              {displayError && (
                <div className="call-lobby__error">
                  <AlertCircle size={16} />
                  <span>{displayError}</span>
                </div>
              )}

              <TextField
                label={t("room_name")}
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder={t("room_name_placeholder") || t("room_name")}
                theme="dark"
              />

              <TextField
                label={t("nickname")}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t("nickname_placeholder") || t("nickname")}
                theme="dark"
              />

              <div className="call-lobby__info">
                <p>{t("lobby_info") || "Microphone and camera state will be taken from sidebar settings."}</p>
              </div>

              <Button
                theme="primary"
                onClick={handleJoinRoom}
                disabled={!roomName.trim() || !nickname.trim() || isConnecting}
                className="call-lobby__join-button"
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={18} className="call-lobby__spinner" />
                    {t("connecting")}
                  </>
                ) : (
                  t("join_call")
                )}
              </Button>

              <div className="call-lobby__decoration call-lobby__decoration--bottom">
                <div className="call-lobby__glow" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const stripParticipants = expandedParticipant ? participants.filter((p) => p.id !== expandedParticipant) : []

  const status = getConnectionStatus()
  const StatusIcon = status.icon

  return (
    <div
      ref={containerRef}
      className={cn("call-page call-page--active", {
        "call-page--fullscreen": isFullscreen,
        "call-page--controls-hidden": controlsHidden,
      })}
      onMouseMove={handleMouseMove}
    >
      <div className="call-page__header">
        <div className="call-page__room-info">
          <button className="call-page__back-btn" onClick={handleLeaveCall}>
            <ArrowLeft size={18} />
          </button>
          <div className={cn("call-page__status", `call-page__status--${status.color}`)}>
            <StatusIcon size={14} className={cn({ "call-page__status-spinner": isConnecting })} />
          </div>
          <h2 className="call-page__room-name">{connectedRoomName}</h2>
          <button className="call-page__copy-link" onClick={handleCopyLink} title={t("copy_link") || "Copy link"}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div className="call-page__header-right">
          {SHOW_DEV_SHARE_STATS && isScreenSharing && (
            <div
              className={cn(
                "call-page__share-stats",
                `call-page__share-stats--${screenShareStats?.quality ?? "unknown"}`,
              )}
            >
              <div className="call-page__share-stats-line">
                <span className="call-page__share-stats-title">LiveKit SFU</span>
                <span className="call-page__share-stats-quality">{qualityLabel(screenShareStats?.quality)}</span>
              </div>
              <div className="call-page__share-stats-line">
                <span>
                  FPS {formatNumber(screenShareStats?.fpsActual ?? null)}/{screenShareStats?.targetFps ?? "-"}
                </span>
                <span>
                  BR {formatKbps(screenShareStats?.bitrateKbps ?? null)} /{" "}
                  {formatKbps(screenShareStats?.expectedBitrateKbps ?? null)}
                </span>
              </div>
              <div className="call-page__share-stats-line">
                <span>
                  RES{" "}
                  {screenShareStats?.currentResolution
                    ? `${screenShareStats.currentResolution[0]}x${screenShareStats.currentResolution[1]}`
                    : "-"}
                  /{screenShareStats ? `${screenShareStats.targetResolution[0]}x${screenShareStats.targetResolution[1]}` : "-"}
                </span>
                <span>
                  LOSS {formatNumber(screenShareStats?.packetLossPercent ?? null, 2)}% | JIT{" "}
                  {formatNumber(screenShareStats?.jitterMs ?? null, 1)} ms
                </span>
              </div>
              <div className="call-page__share-stats-line">
                <span>CODEC {screenShareStats?.codec ?? "-"}</span>
              </div>
            </div>
          )}
          <div className="call-page__participants-count">
            <Users size={16} />
            <span>{participantCount}</span>
          </div>
        </div>
      </div>

      <div className={cn("call-grid", getGridClass())}>
        {expandedParticipant ? (
          <>
            <div className="call-grid__expanded">
              {participants
                .filter((p) => p.id === expandedParticipant)
                .map((participant) => (
                  <ParticipantCard
                    key={participant.id}
                    participant={{
                      id: participant.id,
                      name: participant.name,
                      isSpeaking: participant.isSpeaking,
                      isMuted: participant.isMuted,
                      isCameraOn: participant.isCameraOn,
                      isScreenSharing: participant.isScreenSharing,
                      videoTrack: participant.videoTrack,
                      previewThumbnail: participant.previewThumbnail,
                    }}
                    isLocal={participant.isLocal}
                    isExpanded
                    isPinned={pinnedParticipant === participant.id}
                    onExpand={handleExpandParticipant}
                    onPin={handlePinParticipant}
                    size="large"
                  />
                ))}
            </div>
            {stripParticipants.length > 0 && (
              <div className="call-grid__strip">
                {stripParticipants.map((participant) => (
                  <ParticipantCard
                    key={participant.id}
                    participant={{
                      id: participant.id,
                      name: participant.name,
                      isSpeaking: participant.isSpeaking,
                      isMuted: participant.isMuted,
                      isCameraOn: participant.isCameraOn,
                      isScreenSharing: participant.isScreenSharing,
                      videoTrack: participant.videoTrack,
                      previewThumbnail: participant.previewThumbnail,
                    }}
                    isLocal={participant.isLocal}
                    isPinned={pinnedParticipant === participant.id}
                    onExpand={handleExpandParticipant}
                    onPin={handlePinParticipant}
                    size="small"
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          participants.map((participant) => (
            <ParticipantCard
              key={participant.id}
              participant={{
                id: participant.id,
                name: participant.name,
                isSpeaking: participant.isSpeaking,
                isMuted: participant.isMuted,
                isCameraOn: participant.isCameraOn,
                isScreenSharing: participant.isScreenSharing,
                videoTrack: participant.videoTrack,
                previewThumbnail: participant.previewThumbnail,
              }}
              isLocal={participant.isLocal}
              isPinned={pinnedParticipant === participant.id}
              onExpand={handleExpandParticipant}
              onPin={handlePinParticipant}
              size="medium"
            />
          ))
        )}
      </div>

      {participants
        .filter((participant) => !participant.isLocal && participant.audioTrack)
        .map((participant) => (
          <LiveKitAudio
            key={`audio-${participant.id}`}
            track={participant.audioTrack}
            muted={isDeafened}
          />
        ))}

      <CallControls
        isMuted={isMuted}
        isDeafened={isDeafened}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        screenShareDisabled={!screenShareAvailable}
        screenShareDisabledReason={screenShareUnavailableReason}
        isInCall={true}
        participantCount={participantCount}
        onMuteToggle={toggleMicrophone}
        onDeafenToggle={toggleDeafen}
        onCameraToggle={toggleCamera}
        onScreenShareToggle={handleScreenShareToggle}
        onLeaveCall={handleLeaveCall}
        onFullscreenToggle={handleFullscreenToggle}
        isHidden={controlsHidden}
      />

      <ScreenSharePicker
        visible={showScreenSharePicker}
        onClose={() => setShowScreenSharePicker(false)}
        onSelect={handleScreenShareSelect}
      />
    </div>
  )
}

export default CallPage
