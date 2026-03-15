"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import { Room, RoomEvent, Track, type VideoReceiverStats } from "livekit-client"

import {
  connectLivekitNative,
  disconnectLivekitNative,
  listMediaDevicesNative,
  requestChannelToken,
  type MediaDevice,
} from "../lib/media"
import { useScreenShare } from "../hooks/useScreenShare"
import { useVoice } from "../hooks/useVoice"
import { useCamera } from "../hooks/useCamera"

type ParticipantVideoTrack =
  | MediaStreamTrack
  | {
      mediaStreamTrack?: MediaStreamTrack
      attach?: (element?: HTMLMediaElement) => HTMLMediaElement | HTMLMediaElement[]
      detach?: (element?: HTMLMediaElement) => HTMLMediaElement[]
    }
  | null

type TrackPublicationLike = {
  source?: Track.Source
  isMuted?: boolean
  kind?: Track.Kind
  videoTrack?: {
    mediaStreamTrack?: MediaStreamTrack
    attach?: (element?: HTMLMediaElement) => HTMLMediaElement | HTMLMediaElement[]
    detach?: (element?: HTMLMediaElement) => HTMLMediaElement[]
  } | null
  audioTrack?: {
    attach?: (element?: HTMLMediaElement) => HTMLMediaElement | HTMLMediaElement[]
    detach?: (element?: HTMLMediaElement) => HTMLMediaElement[]
  } | null
  setSubscribed?: (subscribed: boolean) => void
  track?: {
    mediaStreamTrack?: MediaStreamTrack
    attach?: (element?: HTMLMediaElement) => HTMLMediaElement | HTMLMediaElement[]
    detach?: (element?: HTMLMediaElement) => HTMLMediaElement[]
  } | null
}

export interface ParticipantInfo {
  id: string
  name: string
  identity: string
  isSpeaking: boolean
  isMuted: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  connectionQuality: string
  audioLevel: number
  videoTrack?: ParticipantVideoTrack | null
  audioTrack?: TrackPublicationLike | null
  previewThumbnail?: string | null
  isLocal: boolean
}

type RoomVideoTrackLike = {
  kind?: Track.Kind | string
  mediaStreamTrack?: MediaStreamTrack
  attach?: (element?: HTMLMediaElement) => HTMLMediaElement | HTMLMediaElement[]
  detach?: (element?: HTMLMediaElement) => HTMLMediaElement[]
  getReceiverStats?: () => Promise<VideoReceiverStats | undefined>
}

type ShareReceiverSample = {
  timestampMs: number
  bytesReceived: number | null
  framesDecoded: number | null
  packetsReceived: number | null
  packetsLost: number | null
}

type ShareTarget = {
  fps: number
  resolution: [number, number]
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting"

export type ScreenShareQuality = "720p" | "1080p" | "1440p" | "4k"
export type ScreenShareFps = "15" | "30" | "60"

export interface ScreenShareSettingsInput {
  quality: ScreenShareQuality
  fps: ScreenShareFps
  audio: boolean
}

export type ScreenShareLivekitQuality = "excellent" | "good" | "fair" | "poor" | "unknown"

export interface ScreenShareLivekitStats {
  fpsActual: number | null
  targetFps: number
  bitrateKbps: number | null
  expectedBitrateKbps: number
  currentResolution: [number, number] | null
  targetResolution: [number, number]
  packetLossPercent: number | null
  packetsLost: number | null
  jitterMs: number | null
  codec: string | null
  quality: ScreenShareLivekitQuality
  updatedAt: number
}

interface CallContextValue {
  connectionState: ConnectionState
  isConnected: boolean
  isConnecting: boolean
  error: string | null

  localParticipant: ParticipantInfo | null
  isMuted: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  screenShareAvailable: boolean
  screenShareUnavailableReason: string | null
  isDeafened: boolean

  participants: ParticipantInfo[]
  participantCount: number

  roomName: string
  screenShareStats: ScreenShareLivekitStats | null

  connect: (roomId: string, userId: string, userName: string) => Promise<void>
  disconnect: () => Promise<void>
  toggleMicrophone: () => Promise<void>
  toggleCamera: () => Promise<void>
  toggleScreenShare: (
    sourceId?: string,
    settings?: ScreenShareSettingsInput,
    previewThumbnail?: string,
  ) => Promise<void>
  toggleDeafen: () => void

  setAudioDevice: (deviceId: string) => Promise<void>
  setVideoDevice: (deviceId: string) => Promise<void>
  setAudioOutputDevice: (deviceId: string) => Promise<void>

  setInitialMicState: (muted: boolean) => void
  setInitialCameraState: (enabled: boolean) => void

  audioInputDevices: MediaDevice[]
  audioOutputDevices: MediaDevice[]
  videoInputDevices: MediaDevice[]
  selectedAudioInput: string
  selectedAudioOutput: string
  selectedVideoInput: string
  refreshDevices: () => Promise<void>
}

const CallContext = createContext<CallContextValue | null>(null)

export const useCall = () => {
  const context = useContext(CallContext)
  if (!context) {
    throw new Error("useCall must be used within a CallProvider")
  }
  return context
}

interface CallProviderProps {
  children: React.ReactNode
}

const QUALITY_TO_RESOLUTION: Record<ScreenShareQuality, [number, number]> = {
  "720p": [1280, 720],
  "1080p": [1920, 1080],
  "1440p": [2560, 1440],
  "4k": [3840, 2160],
}

const DEFAULT_SHARE_SETTINGS: ScreenShareSettingsInput = {
  quality: "1080p",
  fps: "30",
  audio: true,
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

const estimateExpectedBitrateKbps = (resolution: [number, number], fps: number) => {
  const pixelsPerSecond = resolution[0] * resolution[1] * Math.max(1, fps)
  return Math.max(1000, Math.round(pixelsPerSecond / 16_000))
}

const evaluateLivekitScreenShareQuality = ({
  fpsActual,
  targetFps,
  bitrateKbps,
  expectedBitrateKbps,
  packetLossPercent,
  jitterMs,
}: {
  fpsActual: number | null
  targetFps: number
  bitrateKbps: number | null
  expectedBitrateKbps: number
  packetLossPercent: number | null
  jitterMs: number | null
}): ScreenShareLivekitQuality => {
  if (fpsActual === null && bitrateKbps === null) {
    return "unknown"
  }

  const fpsScore = fpsActual === null ? 0 : clamp(fpsActual / Math.max(1, targetFps), 0, 1)
  const bitrateScore =
    bitrateKbps === null ? 0 : clamp(bitrateKbps / Math.max(1, expectedBitrateKbps), 0, 1)

  let penalty = 0
  if (packetLossPercent !== null) {
    if (packetLossPercent >= 3) penalty += 0.35
    else if (packetLossPercent >= 1) penalty += 0.2
    else if (packetLossPercent >= 0.3) penalty += 0.1
  }
  if (jitterMs !== null) {
    if (jitterMs >= 80) penalty += 0.2
    else if (jitterMs >= 40) penalty += 0.1
  }

  const score = clamp(fpsScore * 0.6 + bitrateScore * 0.4 - penalty, 0, 1)
  if (score >= 0.85) return "excellent"
  if (score >= 0.7) return "good"
  if (score >= 0.5) return "fair"
  return "poor"
}

const normalizeConnectionQuality = (quality: unknown): string => {
  const value = String(quality ?? "excellent").toLowerCase()
  if (value.includes("poor")) return "poor"
  if (value.includes("good")) return "good"
  return "excellent"
}


const hasEnabledSource = (participant: { trackPublications: Map<string, TrackPublicationLike> }, source: Track.Source) => {
  const publications = Array.from(participant.trackPublications.values())
  return publications.some((publication) => publication.source === source && publication.isMuted !== true)
}

const pickVideoRenderableTrack = (publication?: TrackPublicationLike): ParticipantVideoTrack => {
  if (!publication) return null
  if (publication.videoTrack) return publication.videoTrack
  if (publication.track) return publication.track
  return null
}

const getParticipantVideoTrack = (participant: { trackPublications: Map<string, TrackPublicationLike> }): ParticipantVideoTrack => {
  const publications = Array.from(participant.trackPublications.values())
  const activeVideoPublications = publications.filter(
    (publication) => publication.kind === Track.Kind.Video && publication.isMuted !== true,
  )

  const screenTrack = pickVideoRenderableTrack(
    activeVideoPublications.find((publication) => publication.source === Track.Source.ScreenShare),
  )
  if (screenTrack) {
    return screenTrack
  }

  return pickVideoRenderableTrack(
    activeVideoPublications.find((publication) => publication.source === Track.Source.Camera),
  )
}

const getParticipantCameraTrack = (participant: { trackPublications: Map<string, TrackPublicationLike> }): ParticipantVideoTrack => {
  const publications = Array.from(participant.trackPublications.values())
  return (
    pickVideoRenderableTrack(
      publications.find(
        (publication) =>
          publication.kind === Track.Kind.Video &&
          publication.source === Track.Source.Camera &&
          publication.isMuted !== true,
      ),
    ) ?? null
  )
}

const getParticipantAudioTrack = (participant: { trackPublications: Map<string, TrackPublicationLike> }): TrackPublicationLike | null => {
  const publications = Array.from(participant.trackPublications.values())
  return (
    publications.find(
      (publication) =>
        publication.kind === Track.Kind.Audio && publication.isMuted !== true,
    ) ?? null
  )
}

const getParticipantScreenTrack = (participant: {
  trackPublications: Map<string, TrackPublicationLike>
  getTrackPublication?: (source: Track.Source) => TrackPublicationLike | undefined
}): ParticipantVideoTrack => {
  const screenPublication = participant.getTrackPublication?.(Track.Source.ScreenShare)
  if (screenPublication) {
    screenPublication.setSubscribed?.(true)
    const renderable = pickVideoRenderableTrack(screenPublication)
    if (renderable) {
      return renderable
    }

    const fromVideoTrack = screenPublication.videoTrack?.mediaStreamTrack ?? null
    if (fromVideoTrack) {
      return fromVideoTrack
    }
    const fromTrack = screenPublication.track?.mediaStreamTrack ?? null
    if (fromTrack) {
      return fromTrack
    }
  }

  const publications = Array.from(participant.trackPublications.values())
  return (
    pickVideoRenderableTrack(
      publications.find(
        (publication) => publication.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare,
      ),
    ) ?? null
  )
}

const isTrackWithReceiverStats = (track: ParticipantVideoTrack): track is RoomVideoTrackLike => {
  if (!track || typeof track !== "object") {
    return false
  }
  return typeof (track as RoomVideoTrackLike).getReceiverStats === "function"
}

const mapParticipant = (
  participant: {
    identity: string
    name?: string
    isSpeaking?: boolean
    audioLevel?: number
    connectionQuality?: unknown
    trackPublications: Map<string, TrackPublicationLike>
    isMicrophoneEnabled?: boolean
  },
  isLocal: boolean,
): ParticipantInfo => {
  const cameraOn = hasEnabledSource(participant, Track.Source.Camera)
  const screenOn = hasEnabledSource(participant, Track.Source.ScreenShare)
  const muted = participant.isMicrophoneEnabled === undefined ? false : !participant.isMicrophoneEnabled
  const videoTrack = getParticipantVideoTrack(participant)
  const audioTrack = getParticipantAudioTrack(participant)

  return {
    id: participant.identity,
    name: participant.name || participant.identity,
    identity: participant.identity,
    isSpeaking: Boolean(participant.isSpeaking),
    isMuted: muted,
    isCameraOn: cameraOn,
    isScreenSharing: screenOn,
    connectionQuality: normalizeConnectionQuality(participant.connectionQuality),
    audioLevel: participant.audioLevel ?? 0,
    videoTrack,
    audioTrack,
    isLocal,
  }
}

export const CallProvider: React.FC<CallProviderProps> = ({ children }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const [error, setError] = useState<string | null>(null)

  const [localParticipant, setLocalParticipant] = useState<ParticipantInfo | null>(null)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])

  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)

  const [roomName, setRoomName] = useState("")
  const [screenShareStats, setScreenShareStats] = useState<ScreenShareLivekitStats | null>(null)
  const voice = useVoice()
  const camera = useCamera()
  const screenShare = useScreenShare()

  useEffect(() => {
    if (voice.error) {
      setError(voice.error)
    }
  }, [voice.error])

  useEffect(() => {
    if (screenShare.error) {
      setError(screenShare.error)
    }
  }, [screenShare.error])

  useEffect(() => {
    if (camera.error) {
      setError(camera.error)
    }
  }, [camera.error])

  const [audioInputDevices, setAudioInputDevices] = useState<MediaDevice[]>([])
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDevice[]>([])
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDevice[]>([])
  const [selectedAudioInput, setSelectedAudioInput] = useState("")
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("")
  const [selectedVideoInput, setSelectedVideoInput] = useState("")

  const roomRef = useRef<Room | null>(null)
  const screenCaptureSessionIdRef = useRef<string | null>(null)
  const localNativeScreenTrackRef = useRef<ParticipantVideoTrack>(null)
  const localNativeCameraTrackRef = useRef<ParticipantVideoTrack>(null)
  const localNativeAudioTrackRef = useRef<TrackPublicationLike | null>(null)
  const localShareThumbnailRef = useRef<string | null>(null)
  const shareTargetRef = useRef<ShareTarget>({
    fps: Number(DEFAULT_SHARE_SETTINGS.fps),
    resolution: QUALITY_TO_RESOLUTION[DEFAULT_SHARE_SETTINGS.quality],
  })
  const shareStatsSampleRef = useRef<ShareReceiverSample | null>(null)
  const connectedIdentityRef = useRef<string>("")
  const connectedNameRef = useRef<string>("")

  const initialMicMuted = useRef(false)
  const initialCameraEnabled = useRef(false)

  const refreshDevices = useCallback(async () => {
    try {
      const snapshot = await listMediaDevicesNative()
      const inputs = snapshot.audioInputs ?? []
      const outputs = snapshot.audioOutputs ?? []
      const videos = snapshot.videoInputs ?? []

      setAudioInputDevices(inputs)
      setAudioOutputDevices(outputs)
      setVideoInputDevices(videos)

      setSelectedAudioInput((previous) => {
        if (previous && inputs.some((device) => device.id === previous)) {
          return previous
        }
        return inputs.find((device) => device.isDefault)?.id ?? inputs[0]?.id ?? ""
      })
      setSelectedAudioOutput((previous) => {
        if (previous && outputs.some((device) => device.id === previous)) {
          return previous
        }
        return outputs.find((device) => device.isDefault)?.id ?? outputs[0]?.id ?? ""
      })
      setSelectedVideoInput((previous) => {
        if (previous && videos.some((device) => device.id === previous)) {
          return previous
        }
        return videos.find((device) => device.isDefault)?.id ?? videos[0]?.id ?? ""
      })
    } catch (err) {
      console.error("Failed to enumerate devices:", err)
    }
  }, [])

  const setInitialMicState = useCallback((muted: boolean) => {
    initialMicMuted.current = muted
    setIsMuted(muted)
  }, [])

  const setInitialCameraState = useCallback((enabled: boolean) => {
    initialCameraEnabled.current = enabled
    setIsCameraOn(enabled)
  }, [])

  const syncParticipantsFromRoom = useCallback((room: Room) => {
    const localIdentity = connectedIdentityRef.current || room.localParticipant.identity
    let localInfo = mapParticipant(room.localParticipant, true)
    let localNativeScreenTrack: ParticipantVideoTrack = localNativeScreenTrackRef.current
    let localNativeCameraTrack: ParticipantVideoTrack = localNativeCameraTrackRef.current
    let localNativeAudioTrack: TrackPublicationLike | null = localNativeAudioTrackRef.current
    let hasLocalNativeParticipant = false

    const isLocalNativeIdentity = (identity: string) =>
      localIdentity && identity.startsWith(`${localIdentity}_`)

    const remoteInfos = Array.from(room.remoteParticipants.values())
      .filter((participant) => {
        const isLocalNativeParticipant = isLocalNativeIdentity(participant.identity)

        if (isLocalNativeParticipant) {
          hasLocalNativeParticipant = true
          localNativeScreenTrack = localNativeScreenTrack ?? getParticipantScreenTrack(participant)
          localNativeCameraTrack = localNativeCameraTrack ?? getParticipantCameraTrack(participant)
          localNativeAudioTrack = localNativeAudioTrack ?? getParticipantAudioTrack(participant)
          return false
        }

        return true
      })
      .map((participant) => mapParticipant(participant, false))

    if (localNativeScreenTrack) {
      localInfo = {
        ...localInfo,
        isScreenSharing: true,
        isCameraOn: localInfo.isCameraOn || Boolean(localNativeCameraTrack),
        videoTrack: localNativeScreenTrack,
        audioTrack: localNativeAudioTrack,
        previewThumbnail: localShareThumbnailRef.current,
      }
    } else if (localNativeCameraTrack) {
      localInfo = {
        ...localInfo,
        isCameraOn: true,
        videoTrack: localNativeCameraTrack,
        audioTrack: localNativeAudioTrack,
        previewThumbnail: localShareThumbnailRef.current,
      }
    } else if (hasLocalNativeParticipant) {
      localInfo = {
        ...localInfo,
        isScreenSharing: true,
        audioTrack: localNativeAudioTrack,
        previewThumbnail: localShareThumbnailRef.current,
      }
    } else if (screenCaptureSessionIdRef.current) {
      // Keep local share state visible during short participant/track reconnect gaps.
      localInfo = {
        ...localInfo,
        isScreenSharing: true,
        audioTrack: localNativeAudioTrack,
        previewThumbnail: localShareThumbnailRef.current,
      }
    }

    localInfo = {
      ...localInfo,
      isMuted: !voice.active,
    }

    localNativeScreenTrackRef.current = localNativeScreenTrack
    localNativeCameraTrackRef.current = localNativeCameraTrack
    localNativeAudioTrackRef.current = localNativeAudioTrack

    setLocalParticipant(localInfo)
    setParticipants([localInfo, ...remoteInfos])
    setIsMuted(!voice.active)
    setIsCameraOn(localInfo.isCameraOn)
    setIsScreenSharing(
      localInfo.isScreenSharing || Boolean(screenCaptureSessionIdRef.current) || screenShare.sharing,
    )
  }, [screenShare.sharing, voice.active])

  const stopActiveScreenShare = useCallback(async () => {
    if (screenCaptureSessionIdRef.current) {
      try {
        await screenShare.stop()
      } catch (err) {
        console.warn("Failed to stop native LiveKit screen share:", err)
      }
      screenCaptureSessionIdRef.current = null
      localNativeScreenTrackRef.current = null
      shareStatsSampleRef.current = null
      setScreenShareStats(null)
    }
  }, [screenShare])

  useEffect(() => {
    if (!screenShare.sharing && screenCaptureSessionIdRef.current) {
      screenCaptureSessionIdRef.current = null
      localNativeScreenTrackRef.current = null
      shareStatsSampleRef.current = null
      setScreenShareStats(null)
      setIsScreenSharing(false)
    }
  }, [screenShare.sharing])

  useEffect(() => {
    if (!isScreenSharing) {
      setScreenShareStats(null)
      shareStatsSampleRef.current = null
      return
    }

    let cancelled = false

    const pollStats = async () => {
      const track = localNativeScreenTrackRef.current
      if (!isTrackWithReceiverStats(track)) {
        shareStatsSampleRef.current = null
        if (!cancelled) {
          setScreenShareStats(null)
        }
        return
      }

      try {
        const receiverStats = await track.getReceiverStats?.()
        if (!receiverStats || cancelled) {
          return
        }

        const timestampMs = Number(receiverStats.timestamp ?? Date.now())
        const currentSample: ShareReceiverSample = {
          timestampMs,
          bytesReceived: typeof receiverStats.bytesReceived === "number" ? receiverStats.bytesReceived : null,
          framesDecoded: typeof receiverStats.framesDecoded === "number" ? receiverStats.framesDecoded : null,
          packetsReceived:
            typeof receiverStats.packetsReceived === "number" ? receiverStats.packetsReceived : null,
          packetsLost: typeof receiverStats.packetsLost === "number" ? receiverStats.packetsLost : null,
        }

        const previousSample = shareStatsSampleRef.current
        shareStatsSampleRef.current = currentSample

        let bitrateKbps: number | null = null
        let fpsActual: number | null = null
        let packetLossPercent: number | null = null

        if (previousSample && currentSample.timestampMs > previousSample.timestampMs) {
          const intervalSec = (currentSample.timestampMs - previousSample.timestampMs) / 1000

          if (
            intervalSec > 0 &&
            currentSample.bytesReceived !== null &&
            previousSample.bytesReceived !== null &&
            currentSample.bytesReceived >= previousSample.bytesReceived
          ) {
            const deltaBytes = currentSample.bytesReceived - previousSample.bytesReceived
            bitrateKbps = (deltaBytes * 8) / intervalSec / 1000
          }

          if (
            intervalSec > 0 &&
            currentSample.framesDecoded !== null &&
            previousSample.framesDecoded !== null &&
            currentSample.framesDecoded >= previousSample.framesDecoded
          ) {
            const deltaFrames = currentSample.framesDecoded - previousSample.framesDecoded
            fpsActual = deltaFrames / intervalSec
          }

          if (
            currentSample.packetsReceived !== null &&
            previousSample.packetsReceived !== null &&
            currentSample.packetsLost !== null &&
            previousSample.packetsLost !== null &&
            currentSample.packetsReceived >= previousSample.packetsReceived &&
            currentSample.packetsLost >= previousSample.packetsLost
          ) {
            const deltaReceived = currentSample.packetsReceived - previousSample.packetsReceived
            const deltaLost = currentSample.packetsLost - previousSample.packetsLost
            const total = deltaReceived + deltaLost
            packetLossPercent = total > 0 ? (deltaLost / total) * 100 : 0
          }
        }

        const target = shareTargetRef.current
        const expectedBitrateKbps = estimateExpectedBitrateKbps(target.resolution, target.fps)
        const jitterMs =
          typeof receiverStats.jitter === "number" ? Math.max(0, receiverStats.jitter * 1000) : null
        const currentResolution =
          typeof receiverStats.frameWidth === "number" && typeof receiverStats.frameHeight === "number"
            ? ([receiverStats.frameWidth, receiverStats.frameHeight] as [number, number])
            : null

        const quality = evaluateLivekitScreenShareQuality({
          fpsActual,
          targetFps: target.fps,
          bitrateKbps,
          expectedBitrateKbps,
          packetLossPercent,
          jitterMs,
        })

        setScreenShareStats({
          fpsActual,
          targetFps: target.fps,
          bitrateKbps,
          expectedBitrateKbps,
          currentResolution,
          targetResolution: target.resolution,
          packetLossPercent,
          packetsLost: currentSample.packetsLost,
          jitterMs,
          codec: receiverStats.mimeType ?? null,
          quality,
          updatedAt: Date.now(),
        })
      } catch (err) {
        console.debug("Failed to read LiveKit receiver stats for screen share:", err)
      }
    }

    void pollStats()
    const timer = window.setInterval(() => {
      void pollStats()
    }, 1000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isScreenSharing])

  const connect = useCallback(
    async (roomId: string, userId: string, userName: string) => {
      try {
        setError(null)
        setConnectionState("connecting")

        if (roomRef.current) {
          await roomRef.current.disconnect()
          roomRef.current = null
        }

        await disconnectLivekitNative().catch(() => undefined)

        const { url, token } = await requestChannelToken(roomId, "voice")
        const publisherToken = await requestChannelToken(roomId, "voice", "native")
        await connectLivekitNative({
          livekitUrl: publisherToken.url,
          token: publisherToken.token,
        })

        const room = new Room({
          adaptiveStream: false,
          dynacast: true,
        })

        const refresh = () => syncParticipantsFromRoom(room)
        const isLocalNativeShareIdentity = (identity: string) => {
          const localIdentity = connectedIdentityRef.current || room.localParticipant.identity
          return (
            identity === `${localIdentity}_native_share` ||
            (identity.endsWith("_native_share") && identity.startsWith(localIdentity))
          )
        }

        room
          .on(RoomEvent.Connected, refresh)
          .on(RoomEvent.ParticipantConnected, refresh)
          .on(RoomEvent.ParticipantDisconnected, (participant) => {
            if (isLocalNativeShareIdentity(participant.identity)) {
              localNativeScreenTrackRef.current = null
              shareStatsSampleRef.current = null
              setScreenShareStats(null)
            }
            refresh()
          })
          .on(RoomEvent.TrackPublished, (_publication, participant) => {
            if (isLocalNativeShareIdentity(participant.identity)) {
              const screenPub = participant.getTrackPublication(Track.Source.ScreenShare)
              screenPub?.setSubscribed(true)
            }
            refresh()
          })
          .on(RoomEvent.TrackUnpublished, (_publication, participant) => {
            if (isLocalNativeShareIdentity(participant.identity)) {
              localNativeScreenTrackRef.current = null
              shareStatsSampleRef.current = null
              setScreenShareStats(null)
            }
            refresh()
          })
          .on(RoomEvent.TrackMuted, refresh)
          .on(RoomEvent.TrackUnmuted, refresh)
          .on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
            if (isLocalNativeShareIdentity(participant.identity)) {
              const remoteTrack = track as RoomVideoTrackLike
              if (
                remoteTrack.kind === Track.Kind.Video ||
                remoteTrack.kind === "video" ||
                remoteTrack.mediaStreamTrack?.kind === "video"
              ) {
                localNativeScreenTrackRef.current = remoteTrack
              }
            }
            refresh()
          })
          .on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
            if (isLocalNativeShareIdentity(participant.identity)) {
              const remoteTrack = track as RoomVideoTrackLike
              if (
                remoteTrack.kind === Track.Kind.Video ||
                remoteTrack.kind === "video" ||
                remoteTrack.mediaStreamTrack?.kind === "video"
              ) {
                localNativeScreenTrackRef.current = null
                shareStatsSampleRef.current = null
                setScreenShareStats(null)
              }
            }
            refresh()
          })
          .on(RoomEvent.ActiveSpeakersChanged, refresh)
          .on(RoomEvent.ConnectionQualityChanged, refresh)
          .on(RoomEvent.LocalTrackPublished, refresh)
          .on(RoomEvent.LocalTrackUnpublished, refresh)

        await room.connect(url, token)

        roomRef.current = room
        setRoomName(roomId)
        connectedIdentityRef.current = userId
        connectedNameRef.current = userName

        if (!initialMicMuted.current) {
          await voice.join({
            inputDeviceId: selectedAudioInput || undefined,
          })
        }
        if (initialCameraEnabled.current) {
          await camera.start({
            deviceId: selectedVideoInput || undefined,
          })
        }

        syncParticipantsFromRoom(room)
        await refreshDevices()
        setConnectionState("connected")
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to connect"
        setError(errorMessage)
        setConnectionState("disconnected")
        throw err
      }
    },
    [
      camera,
      refreshDevices,
      selectedAudioInput,
      syncParticipantsFromRoom,
      voice,
    ],
  )

  const disconnect = useCallback(async () => {
    await stopActiveScreenShare()
    if (voice.active) {
      await voice.leave()
    }
    if (camera.active) {
      await camera.stop()
    }
    await disconnectLivekitNative().catch(() => undefined)

    if (roomRef.current) {
      roomRef.current.removeAllListeners()
      await roomRef.current.disconnect()
      roomRef.current = null
    }

    setParticipants([])
    setLocalParticipant(null)
    setRoomName("")
    connectedIdentityRef.current = ""
    connectedNameRef.current = ""
    localNativeScreenTrackRef.current = null
    localNativeCameraTrackRef.current = null
    localNativeAudioTrackRef.current = null
    localShareThumbnailRef.current = null
    shareStatsSampleRef.current = null
    setScreenShareStats(null)
    setIsMuted(false)
    setIsCameraOn(false)
    setIsScreenSharing(false)
    setConnectionState("disconnected")
  }, [camera, stopActiveScreenShare, voice])

  const toggleMicrophone = useCallback(async () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)

    const room = roomRef.current
    if (room) {
      if (nextMuted) {
        if (voice.active) {
          await voice.leave()
        }
      } else {
        await voice.join({
          inputDeviceId: selectedAudioInput || undefined,
        })
      }
      syncParticipantsFromRoom(room)
    }
  }, [
    isMuted,
    selectedAudioInput,
    syncParticipantsFromRoom,
    voice,
  ])

  const toggleCamera = useCallback(async () => {
    const nextCameraState = !isCameraOn
    setIsCameraOn(nextCameraState)

    const room = roomRef.current
    if (room) {
      if (nextCameraState) {
        await camera.start({
          deviceId: selectedVideoInput || undefined,
        })
      } else if (camera.active) {
        await camera.stop()
      }
      syncParticipantsFromRoom(room)
    }
  }, [camera, isCameraOn, selectedVideoInput, syncParticipantsFromRoom])

  const toggleScreenShare = useCallback(
    async (sourceId?: string, settings?: ScreenShareSettingsInput, previewThumbnail?: string) => {
      const room = roomRef.current
      if (!room) {
        throw new Error("Room is not connected")
      }

      if (isScreenSharing) {
        await stopActiveScreenShare()
        shareTargetRef.current = {
          fps: Number(DEFAULT_SHARE_SETTINGS.fps),
          resolution: QUALITY_TO_RESOLUTION[DEFAULT_SHARE_SETTINGS.quality],
        }
        shareStatsSampleRef.current = null
        setScreenShareStats(null)
        localShareThumbnailRef.current = null
        localNativeScreenTrackRef.current = null
        setIsScreenSharing(false)
        syncParticipantsFromRoom(room)
        return
      }

      const resolved = settings ?? DEFAULT_SHARE_SETTINGS
      const resolution = QUALITY_TO_RESOLUTION[resolved.quality]
      const fps = Number(resolved.fps)
      shareTargetRef.current = { fps, resolution }
      shareStatsSampleRef.current = null
      setScreenShareStats(null)
      if (!screenShare.available) {
        throw new Error(
          screenShare.unavailableReason ||
            "Screen sharing is not available on this device",
        )
      }

      try {
        await screenShare.start({
          sourceId,
          resolution,
          cursor: true,
          fps,
          bitrateKbps: estimateExpectedBitrateKbps(resolution, fps),
        })

        screenCaptureSessionIdRef.current = "native-screen-share-active"
        localShareThumbnailRef.current = previewThumbnail ?? null
        setIsScreenSharing(true)
        syncParticipantsFromRoom(room)
      } catch (err) {
        screenCaptureSessionIdRef.current = null
        localShareThumbnailRef.current = null
        localNativeScreenTrackRef.current = null
        shareStatsSampleRef.current = null
        setScreenShareStats(null)
        throw err
      }
    },
    [
      isScreenSharing,
      screenShare,
      stopActiveScreenShare,
      syncParticipantsFromRoom,
    ],
  )

  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => !prev)
  }, [])

  const setAudioDevice = useCallback(async (deviceId: string) => {
    setSelectedAudioInput(deviceId)
    const room = roomRef.current
    if (!room || !voice.active) {
      return
    }

    await voice.leave()
    await voice.join({
      inputDeviceId: deviceId || undefined,
    })
    syncParticipantsFromRoom(room)
  }, [syncParticipantsFromRoom, voice])

  const setVideoDevice = useCallback(async (deviceId: string) => {
    setSelectedVideoInput(deviceId)
    if (!camera.active) {
      return
    }

    try {
      await camera.stop()
      await camera.start({ deviceId: deviceId || undefined })
      const room = roomRef.current
      if (room) {
        syncParticipantsFromRoom(room)
      }
    } catch (err) {
      console.warn("Failed to restart camera with new device:", err)
    }
  }, [camera, syncParticipantsFromRoom])

  const setAudioOutputDevice = useCallback(async (deviceId: string) => {
    setSelectedAudioOutput(deviceId)
  }, [])

  useEffect(() => {
    void refreshDevices()
    const hasDeviceEvents =
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices && "addEventListener" in navigator.mediaDevices)
    if (!hasDeviceEvents) {
      return
    }
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices)
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", refreshDevices)
    }
  }, [refreshDevices])

  useEffect(() => {
    return () => {
      void disconnect()
    }
  }, [disconnect])

  const value: CallContextValue = {
    connectionState,
    isConnected: connectionState === "connected",
    isConnecting: connectionState === "connecting",
    error,

    localParticipant,
    isMuted,
    isCameraOn,
    isScreenSharing,
    screenShareAvailable: screenShare.available,
    screenShareUnavailableReason: screenShare.unavailableReason,
    isDeafened,

    participants,
    participantCount: participants.length,

    roomName,
    screenShareStats,

    connect,
    disconnect,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    toggleDeafen,
    setAudioDevice,
    setVideoDevice,
    setAudioOutputDevice,
    setInitialMicState,
    setInitialCameraState,

    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    selectedVideoInput,
    refreshDevices,
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}
