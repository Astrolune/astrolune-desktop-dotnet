import { invoke } from "@tauri-apps/api/core"
import type { CaptureSource } from "./capture"

export interface LivekitTokenRequest {
  roomName: string
  identity: string
  name: string
  ttlSeconds?: number
}

export interface LivekitTokenResponse {
  url: string
  token: string
  roomName: string
  identity: string
}

export const createLivekitAccessToken = (request: LivekitTokenRequest) =>
  invoke<LivekitTokenResponse>("create_livekit_access_token", { request })

export interface NativeLivekitShareOptions {
  fps: number
  resolution: [number, number]
  cursor: boolean
}

export const getLivekitCaptureSources = () =>
  invoke<CaptureSource[]>("get_livekit_capture_sources")

export const startNativeLivekitScreenShare = (
  url: string,
  token: string,
  sourceId: string,
  options: NativeLivekitShareOptions,
) =>
  invoke<string>("start_native_livekit_screen_share", {
    url,
    token,
    sourceId,
    options,
  })

export const stopNativeLivekitScreenShare = (sessionId: string) =>
  invoke<void>("stop_native_livekit_screen_share", { sessionId })
