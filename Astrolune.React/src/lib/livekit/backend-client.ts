import { fetchWithRequiredAuth } from "../auth/session"

const DEFAULT_MEDIA_API_URL = "http://localhost:5005/api"

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "")

const normalizeLivekitApiUrl = (value: string) => {
  const trimmed = normalizeBaseUrl(value)
  if (!trimmed) {
    return normalizeBaseUrl(DEFAULT_MEDIA_API_URL)
  }

  if (trimmed.endsWith("/livekit")) {
    return trimmed
  }

  if (trimmed.endsWith("/api")) {
    return `${trimmed}/livekit`
  }

  return `${trimmed}/api/livekit`
}

const LIVEKIT_API_URL = normalizeLivekitApiUrl(
  (import.meta.env.VITE_LIVEKIT_API_URL as string | undefined) ||
    (import.meta.env.VITE_MEDIA_API_URL as string | undefined) ||
    DEFAULT_MEDIA_API_URL,
)

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

interface ApiEnvelope<T> {
  success?: boolean
  ok?: boolean
  data?: T
  error?: string
  message?: string
  code?: string
}

export interface LivekitTokenRequest {
  room: string
  identity: string
  name?: string
  metadata?: string
  ttlSeconds?: number
  grants?: Record<string, unknown>
}

export interface LivekitTokenResponse {
  token: string
  url: string
  room: string
  identity?: string
  expiresAt?: string
}

export interface LivekitRoom {
  name: string
  sid?: string
  createdAt?: string
  maxParticipants?: number
  participantCount?: number
  metadata?: string | null
}

export interface LivekitRoomCreateRequest {
  name: string
  maxParticipants?: number
  metadata?: string | null
  emptyTimeoutSeconds?: number
}

export interface LivekitParticipant {
  identity: string
  name?: string
  state?: string
  joinedAt?: string
  metadata?: string | null
  tracks?: LivekitTrackInfo[]
}

export interface LivekitTrackInfo {
  sid?: string
  name?: string
  kind?: "audio" | "video" | string
  source?: string
  muted?: boolean
}

export interface LivekitParticipantUpdateRequest {
  metadata?: string | null
  name?: string
  permissions?: Record<string, unknown>
}

const buildUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const base = normalizeBaseUrl(LIVEKIT_API_URL)
  if (!path) {
    return base
  }

  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

const parsePayload = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    return (await response.text()) as T
  }

  const payload = (await response.json()) as ApiEnvelope<T>
  if (payload && typeof payload === "object") {
    if (payload.success === false || payload.ok === false) {
      throw new Error(payload.error || payload.message || "LiveKit API error")
    }
    if (payload.data !== undefined) {
      return payload.data
    }
  }

  return payload as T
}

const request = async <T>(path: string, method: HttpMethod, body?: unknown): Promise<T> => {
  const response = await fetchWithRequiredAuth(buildUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(text || `LiveKit API request failed (${response.status})`)
  }

  return parsePayload<T>(response)
}

export class LivekitBackendClient {
  async createToken(payload: LivekitTokenRequest): Promise<LivekitTokenResponse> {
    return request<LivekitTokenResponse>("/tokens", "POST", payload)
  }

  async listRooms(): Promise<LivekitRoom[]> {
    return request<LivekitRoom[]>("/rooms", "GET")
  }

  async createRoom(payload: LivekitRoomCreateRequest): Promise<LivekitRoom> {
    return request<LivekitRoom>("/rooms", "POST", payload)
  }

  async getRoom(roomName: string): Promise<LivekitRoom> {
    return request<LivekitRoom>(`/rooms/${encodeURIComponent(roomName)}`, "GET")
  }

  async deleteRoom(roomName: string): Promise<void> {
    await request<void>(`/rooms/${encodeURIComponent(roomName)}`, "DELETE")
  }

  async listParticipants(roomName: string): Promise<LivekitParticipant[]> {
    return request<LivekitParticipant[]>(`/rooms/${encodeURIComponent(roomName)}/participants`, "GET")
  }

  async getParticipant(roomName: string, identity: string): Promise<LivekitParticipant> {
    return request<LivekitParticipant>(
      `/rooms/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(identity)}`,
      "GET",
    )
  }

  async updateParticipant(
    roomName: string,
    identity: string,
    payload: LivekitParticipantUpdateRequest,
  ): Promise<LivekitParticipant> {
    return request<LivekitParticipant>(
      `/rooms/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(identity)}`,
      "PATCH",
      payload,
    )
  }

  async removeParticipant(roomName: string, identity: string): Promise<void> {
    await request<void>(
      `/rooms/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(identity)}`,
      "DELETE",
    )
  }
}

export const livekitBackend = new LivekitBackendClient()
export const livekitApiConfig = {
  baseUrl: LIVEKIT_API_URL,
}
