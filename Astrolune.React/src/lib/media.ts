import { invoke } from "@tauri-apps/api/core"
import { fetchWithRequiredAuth } from "./auth/session"

const normalizeMediaBaseUrl = (value: string) => {
  const trimmed = value.replace(/\/+$/, "")
  if (trimmed.endsWith("/api/media")) {
    return trimmed.slice(0, -"/media".length)
  }
  return trimmed
}

const MEDIA_API_BASE_URL = normalizeMediaBaseUrl(import.meta.env.VITE_MEDIA_API_URL || "http://localhost:5005/api")

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
  message?: string
  error?: string
}

export interface ChannelMediaToken {
  url: string
  token: string
}

export interface StartVoiceRequest {
  inputDeviceId?: string
}

export interface StartCameraRequest {
  deviceId?: string
  resolution?: [number, number]
  fps?: number
}

export interface StartScreenShareRequest {
  sourceId?: string
  resolution?: [number, number]
  cursor?: boolean
  fps?: number
  bitrateKbps?: number
}

export interface AudioInputDevice {
  id: string
  name: string
  isDefault: boolean
}

export interface MediaDevice {
  id: string
  name: string
  kind: "audioinput" | "audiooutput" | "videoinput" | string
  isDefault: boolean
}

export interface MediaDevicesSnapshot {
  audioInputs: MediaDevice[]
  audioOutputs: MediaDevice[]
  videoInputs: MediaDevice[]
}

export interface CaptureSource {
  id: string
  kind: "monitor" | "window" | string
  name: string
  thumbnail: string
  width: number
  height: number
  isPrimary: boolean
}

interface RawCaptureSource {
  id?: string
  kind?: string
  name?: string
  thumbnail?: string
  width?: number
  height?: number
  isPrimary?: boolean
  is_primary?: boolean
}

const normalizeCaptureSourceKind = (source: RawCaptureSource): CaptureSource["kind"] => {
  const rawKind = String(source.kind ?? "").toLowerCase()
  if (rawKind === "monitor" || rawKind === "window") {
    return rawKind
  }

  const id = String(source.id ?? "").toLowerCase()
  if (id.includes("window")) {
    return "window"
  }
  if (id.includes("monitor") || id.includes("screen") || id.includes("display")) {
    return "monitor"
  }

  return rawKind || "monitor"
}

const normalizeCaptureSource = (source: RawCaptureSource): CaptureSource => ({
  id: String(source.id ?? ""),
  kind: normalizeCaptureSourceKind(source),
  name: String(source.name ?? source.id ?? "Untitled source"),
  thumbnail: String(source.thumbnail ?? ""),
  width: Number(source.width ?? 0),
  height: Number(source.height ?? 0),
  isPrimary: Boolean(source.isPrimary ?? source.is_primary ?? false),
})

const parseTokenPayload = (payload: unknown): ChannelMediaToken => {
  const data = payload as Record<string, unknown>
  const url =
    typeof data.url === "string"
      ? data.url
      : typeof data.livekitUrl === "string"
        ? data.livekitUrl
        : ""
  const token = typeof data.token === "string" ? data.token : ""

  if (!url || !token) {
    throw new Error("Token endpoint returned an invalid payload")
  }

  return { url, token }
}

export const requestChannelToken = async (
  channelId: string,
  kind: "voice" | "screenshare",
  identitySuffix?: string,
): Promise<ChannelMediaToken> => {
  const endpoint = `${MEDIA_API_BASE_URL}/voice/join`
  const response = await fetchWithRequiredAuth(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channelId, identitySuffix }),
      credentials: "include",
    },
  )

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Authentication required. Please sign in again.")
    }
    if (response.status === 429) {
      throw new Error("Too many requests. Try again later.")
    }
    throw new Error(`Failed to fetch ${kind} token (${response.status})`)
  }

  const payload = (await response.json()) as ApiEnvelope<Record<string, unknown>>
  if (payload.success === false) {
    throw new Error(payload.error || payload.message || `Failed to fetch ${kind} token`)
  }

  return parseTokenPayload((payload.data ?? payload) as Record<string, unknown>)
}

export const startVoiceNative = (request: StartVoiceRequest) =>
  invoke<void>("start_voice", { request })

export const startScreenShareNative = (request: StartScreenShareRequest) =>
  invoke<void>("start_screen_share", { request })

export const startCameraNative = (request: StartCameraRequest) =>
  invoke<void>("start_camera", { request })

export const stopMediaNative = () => invoke<void>("stop_media")
export const stopVoiceNative = () => invoke<void>("stop_voice")
export const stopScreenShareNative = () => invoke<void>("stop_screen_share")
export const stopCameraNative = () => invoke<void>("stop_camera")

export const connectLivekitNative = (request: { livekitUrl: string; token: string }) =>
  invoke<void>("connect_livekit", { request })

export const disconnectLivekitNative = () => invoke<void>("disconnect_livekit")

export const listAudioInputDevicesNative = () =>
  invoke<AudioInputDevice[]>("list_audio_input_devices")

export const listMediaDevicesNative = () =>
  invoke<MediaDevicesSnapshot>("list_media_devices")

export const listCaptureSourcesNative = async (): Promise<CaptureSource[]> => {
  const sources = await invoke<RawCaptureSource[]>("list_capture_sources")
  return (sources ?? [])
    .map(normalizeCaptureSource)
    .filter((source) => Boolean(source.id))
}
