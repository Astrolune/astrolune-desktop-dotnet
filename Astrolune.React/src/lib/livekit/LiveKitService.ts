import {
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  type RoomConnectOptions,
  type RoomOptions,
  type TrackPublishOptions,
  type VideoEncoding,
  type VideoResolution,
} from "livekit-client"

import {
  LivekitBackendClient,
  type LivekitTokenRequest,
  type LivekitTokenResponse,
  livekitBackend,
} from "./backend-client"
import {
  LivekitRealtimeClient,
  type LivekitRealtimeConnectOptions,
  type LivekitRealtimeHandler,
} from "./realtime-client"

export interface LiveKitServiceOptions {
  backend?: LivekitBackendClient
  realtime?: LivekitRealtimeClient
  roomOptions?: RoomOptions
  connectOptions?: RoomConnectOptions
}

export interface LiveKitConnectWithTokenOptions {
  url: string
  token: string
  connectOptions?: RoomConnectOptions
}

export interface LiveKitConnectWithBackendOptions {
  tokenRequest: LivekitTokenRequest
  connectOptions?: RoomConnectOptions
  realtime?: LivekitRealtimeConnectOptions
}

export interface PublishVideoOptions {
  source?: Track.Source
  name?: string
  encoding?: VideoEncoding
  simulcast?: boolean
}

const DEFAULT_LIVEKIT_WS_URL = (import.meta.env.VITE_LIVEKIT_WS_URL as string | undefined) || ""

export const DEFAULT_4K_RESOLUTION: VideoResolution = {
  width: 3840,
  height: 2160,
  frameRate: 60,
}

export const estimateVideoBitrateKbps = (width: number, height: number, fps: number) => {
  const pixelsPerSecond = Math.max(1, width) * Math.max(1, height) * Math.max(1, fps)
  return Math.max(2000, Math.round(pixelsPerSecond / 16000))
}

export const createVideoEncoding = (
  width: number,
  height: number,
  fps: number,
  maxBitrateKbps?: number,
): VideoEncoding => ({
  maxBitrate: (maxBitrateKbps ?? estimateVideoBitrateKbps(width, height, fps)) * 1000,
  maxFramerate: fps,
  priority: "high",
})

export const DEFAULT_4K_ENCODING = createVideoEncoding(3840, 2160, 60)

export class LiveKitService {
  private backend: LivekitBackendClient
  private realtime: LivekitRealtimeClient | null
  private room: Room | null = null
  private roomOptions: RoomOptions
  private connectOptions: RoomConnectOptions

  constructor(options: LiveKitServiceOptions = {}) {
    this.backend = options.backend ?? livekitBackend
    this.realtime = options.realtime ?? null
    this.roomOptions = {
      adaptiveStream: false,
      dynacast: true,
      singlePeerConnection: true,
      publishDefaults: {
        videoEncoding: DEFAULT_4K_ENCODING,
        screenShareEncoding: DEFAULT_4K_ENCODING,
      },
      videoCaptureDefaults: {
        resolution: DEFAULT_4K_RESOLUTION,
        frameRate: 60,
      },
      ...options.roomOptions,
    }

    this.connectOptions = {
      autoSubscribe: true,
      ...options.connectOptions,
    }
  }

  getRoom(): Room | null {
    return this.room
  }

  async connectWithToken(options: LiveKitConnectWithTokenOptions): Promise<Room> {
    const room = this.ensureRoom()
    await room.connect(options.url, options.token, {
      ...this.connectOptions,
      ...options.connectOptions,
    })
    return room
  }

  async connectWithBackend(options: LiveKitConnectWithBackendOptions): Promise<LivekitTokenResponse> {
    const tokenResponse = await this.backend.createToken(options.tokenRequest)
    await this.connectWithToken({
      url: tokenResponse.url,
      token: tokenResponse.token,
      connectOptions: options.connectOptions,
    })

    const realtimeUrl = options.realtime?.url ?? DEFAULT_LIVEKIT_WS_URL
    if (this.realtime && realtimeUrl) {
      this.realtime.connect({
        url: realtimeUrl,
        room: options.realtime?.room ?? options.tokenRequest.room,
        token: options.realtime?.token ?? tokenResponse.token,
      })
    }

    return tokenResponse
  }

  async disconnect(): Promise<void> {
    this.realtime?.disconnect()
    if (!this.room) {
      return
    }
    this.room.removeAllListeners()
    await this.room.disconnect()
    this.room = null
  }

  async publishVideoTrack(
    track: LocalVideoTrack | MediaStreamTrack,
    options: PublishVideoOptions = {},
  ) {
    const room = this.ensureRoom()
    const localTrack =
      track instanceof MediaStreamTrack ? new LocalVideoTrack(track, undefined, true) : track

    const publishOptions: TrackPublishOptions = {
      name: options.name,
      source: options.source,
      simulcast: options.simulcast ?? false,
      videoEncoding: options.encoding ?? DEFAULT_4K_ENCODING,
    }

    return room.localParticipant.publishTrack(localTrack, publishOptions)
  }

  onRoomEvent(event: RoomEvent, handler: (...args: unknown[]) => void): () => void {
    const room = this.ensureRoom()
    room.on(event, handler)
    return () => {
      room.off(event, handler)
    }
  }

  subscribeRealtime(handler: LivekitRealtimeHandler): (() => void) | null {
    if (!this.realtime) {
      return null
    }
    return this.realtime.subscribe(handler)
  }

  private ensureRoom(): Room {
    if (!this.room) {
      this.room = new Room(this.roomOptions)
    }

    return this.room
  }
}

export const livekitService = new LiveKitService({
  realtime: new LivekitRealtimeClient(),
})
