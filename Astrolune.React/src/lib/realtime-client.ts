import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr"
import { getAccessToken } from "./auth/session"

const DEFAULT_REALTIME_URL = import.meta.env.DEV ? "/realtime/ws" : "http://localhost:6000/ws"
const RAW_REALTIME_URL = (import.meta.env.VITE_REALTIME_WS_URL as string | undefined) || DEFAULT_REALTIME_URL

const normalizeSignalrUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return DEFAULT_REALTIME_URL
  }

  if (trimmed.startsWith("ws://")) {
    return `http://${trimmed.slice(5)}`
  }
  if (trimmed.startsWith("wss://")) {
    return `https://${trimmed.slice(6)}`
  }

  return trimmed
}

export interface RealtimeEventMessage<TData = unknown> {
  event: string
  data: TData
  timestamp: number
  meta?: Record<string, unknown> | null
}

export type RealtimeEventHandler = (event: RealtimeEventMessage) => void
export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const normalizeInboundEvent = (payload: unknown): RealtimeEventMessage | null => {
  if (!payload) {
    return null
  }

  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload) as unknown
      return normalizeInboundEvent(parsed)
    } catch {
      return null
    }
  }

  if (!isRecord(payload)) {
    return null
  }

  const event = typeof payload.event === "string" ? payload.event : "UNKNOWN"
  const timestamp = typeof payload.timestamp === "number" ? payload.timestamp : Date.now()
  const meta = isRecord(payload.meta) ? payload.meta : null
  return {
    event,
    data: payload.data,
    timestamp,
    meta,
  }
}

export class RealtimeClient {
  private connection: HubConnection | null = null
  private handlers: Set<RealtimeEventHandler> = new Set()
  private state: RealtimeConnectionState = "idle"
  private joinedChannels: Set<string> = new Set()

  constructor(private readonly hubUrl: string = normalizeSignalrUrl(RAW_REALTIME_URL)) {}

  async connect(): Promise<void> {
    if (this.connection) {
      const state = this.connection.state
      if (state === HubConnectionState.Connected || state === HubConnectionState.Connecting) {
        return
      }
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      this.state = "disconnected"
      throw new Error("Realtime auth token is missing")
    }

    this.state = "connecting"

    const connection = new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: async () => (await getAccessToken()) ?? accessToken,
      })
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
      .configureLogging(import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning)
      .build()

    connection.on("OnEvent", (payload: unknown) => {
      const event = normalizeInboundEvent(payload)
      if (!event) {
        return
      }
      this.handlers.forEach((handler) => handler(event))
    })

    connection.onreconnecting(() => {
      this.state = "reconnecting"
    })

    connection.onreconnected(async () => {
      this.state = "connected"
      await this.rejoinChannels()
    })

    connection.onclose(() => {
      this.state = "disconnected"
    })

    await connection.start()
    this.connection = connection
    this.state = "connected"
    await this.rejoinChannels()
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      this.state = "disconnected"
      return
    }

    const current = this.connection
    this.connection = null
    try {
      await current.stop()
    } finally {
      this.state = "disconnected"
    }
  }

  subscribe(handler: RealtimeEventHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  async joinChannel(channelId: string): Promise<void> {
    if (!channelId.trim()) {
      return
    }

    this.joinedChannels.add(channelId)
    const connection = await this.ensureConnected()
    await connection.invoke("JoinChannel", channelId)
  }

  async leaveChannel(channelId: string): Promise<void> {
    if (!channelId.trim()) {
      return
    }

    this.joinedChannels.delete(channelId)
    const connection = await this.ensureConnected()
    await connection.invoke("LeaveChannel", channelId)
  }

  async updatePresence(status: string, activity?: string | null): Promise<void> {
    const connection = await this.ensureConnected()
    await connection.invoke("UpdatePresence", {
      status,
      activity: activity || null,
    })
  }

  async startTyping(channelId: string): Promise<void> {
    const connection = await this.ensureConnected()
    await connection.invoke("StartTyping", channelId)
  }

  async updateVoiceState(payload: {
    guildId?: string | null
    channelId?: string | null
    muted: boolean
    deafened: boolean
  }): Promise<void> {
    const connection = await this.ensureConnected()
    await connection.invoke("UpdateVoiceState", payload)
  }

  async dispatch(type: string, data: Record<string, unknown>): Promise<void> {
    const connection = await this.ensureConnected()
    await connection.invoke("Dispatch", {
      type,
      data,
    })
  }

  getConnectionState(): RealtimeConnectionState {
    if (!this.connection) {
      return this.state === "idle" ? "idle" : "disconnected"
    }

    if (this.state === "reconnecting") {
      return "reconnecting"
    }

    return this.connection.state === HubConnectionState.Connected ? "connected" : "connecting"
  }

  private async ensureConnected(): Promise<HubConnection> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      await this.connect()
    }

    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error("Realtime connection is not available")
    }

    return this.connection
  }

  private async rejoinChannels(): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return
    }

    for (const channelId of this.joinedChannels) {
      await this.connection.invoke("JoinChannel", channelId)
    }
  }
}

let realtimeClientSingleton: RealtimeClient | null = null

export const getRealtimeClient = (): RealtimeClient => {
  if (!realtimeClientSingleton) {
    realtimeClientSingleton = new RealtimeClient()
  }
  return realtimeClientSingleton
}

export const disconnectRealtimeClient = async (): Promise<void> => {
  if (!realtimeClientSingleton) {
    return
  }
  await realtimeClientSingleton.disconnect()
  realtimeClientSingleton = null
}
