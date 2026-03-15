export type LivekitRealtimeEventType =
  | "join"
  | "leave"
  | "mute"
  | "screen_share"
  | "chat"
  | "track_published"
  | "track_unpublished"

export interface LivekitRealtimeBaseEvent {
  type: LivekitRealtimeEventType
  room?: string
  timestamp: number
}

export interface LivekitRealtimeParticipantEvent extends LivekitRealtimeBaseEvent {
  type: "join" | "leave"
  payload: {
    identity: string
    name?: string
    metadata?: string | null
  }
}

export interface LivekitRealtimeMuteEvent extends LivekitRealtimeBaseEvent {
  type: "mute"
  payload: {
    identity: string
    kind: "audio" | "video" | string
    muted: boolean
  }
}

export interface LivekitRealtimeScreenShareEvent extends LivekitRealtimeBaseEvent {
  type: "screen_share"
  payload: {
    identity: string
    active: boolean
  }
}

export interface LivekitRealtimeChatEvent extends LivekitRealtimeBaseEvent {
  type: "chat"
  payload: {
    identity: string
    message: string
    messageId?: string
    sentAt?: string
  }
}

export interface LivekitRealtimeTrackEvent extends LivekitRealtimeBaseEvent {
  type: "track_published" | "track_unpublished"
  payload: {
    identity: string
    trackSid?: string
    source?: string
    kind?: string
  }
}

export type LivekitRealtimeEvent =
  | LivekitRealtimeParticipantEvent
  | LivekitRealtimeMuteEvent
  | LivekitRealtimeScreenShareEvent
  | LivekitRealtimeChatEvent
  | LivekitRealtimeTrackEvent

export type LivekitRealtimeHandler = (event: LivekitRealtimeEvent) => void

export interface LivekitRealtimeConnectOptions {
  url: string
  token?: string
  room?: string
}

const buildRealtimeUrl = ({ url, token, room }: LivekitRealtimeConnectOptions) => {
  if (!token && !room) {
    return url
  }

  const params = new URLSearchParams()
  if (token) {
    params.set("token", token)
  }
  if (room) {
    params.set("room", room)
  }

  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}${params.toString()}`
}

const parseRealtimeEvent = (payload: unknown): LivekitRealtimeEvent | null => {
  if (!payload) {
    return null
  }

  if (typeof payload === "string") {
    try {
      return parseRealtimeEvent(JSON.parse(payload))
    } catch {
      return null
    }
  }

  if (typeof payload !== "object") {
    return null
  }

  const record = payload as Record<string, unknown>
  const type = String(record.type || record.event || "").toLowerCase()
  if (!type) {
    return null
  }

  return {
    type: type as LivekitRealtimeEventType,
    room: typeof record.room === "string" ? record.room : undefined,
    timestamp: typeof record.timestamp === "number" ? record.timestamp : Date.now(),
    payload: (record.payload ?? record.data ?? {}) as Record<string, unknown>,
  } as LivekitRealtimeEvent
}

export class LivekitRealtimeClient {
  private socket: WebSocket | null = null
  private handlers: Set<LivekitRealtimeHandler> = new Set()
  private state: "idle" | "connecting" | "connected" | "disconnected" = "idle"

  connect(options: LivekitRealtimeConnectOptions) {
    const url = buildRealtimeUrl(options)
    if (this.socket && this.state === "connected") {
      return
    }

    this.state = "connecting"
    this.socket = new WebSocket(url)

    this.socket.onopen = () => {
      this.state = "connected"
    }

    this.socket.onclose = () => {
      this.state = "disconnected"
      this.socket = null
    }

    this.socket.onerror = () => {
      this.state = "disconnected"
    }

    this.socket.onmessage = (event) => {
      const parsed = parseRealtimeEvent(event.data)
      if (!parsed) {
        return
      }
      this.handlers.forEach((handler) => handler(parsed))
    }
  }

  disconnect() {
    if (!this.socket) {
      this.state = "disconnected"
      return
    }

    this.socket.close()
    this.socket = null
    this.state = "disconnected"
  }

  send(data: Record<string, unknown>) {
    if (!this.socket || this.state !== "connected") {
      throw new Error("Realtime socket is not connected")
    }

    this.socket.send(JSON.stringify(data))
  }

  subscribe(handler: LivekitRealtimeHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  getState() {
    return this.state
  }
}
