import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

export interface AudioCaptureRequest {
  deviceId?: string
  sampleRate?: number
  channels?: number
  noiseGateThreshold?: number
  chunkMs?: number
}

export interface AudioCaptureFrame {
  sessionId: string
  sampleRate: number
  channels: number
  samplesPerChannel: number
  timestampMs: number
  format: "s16le" | string
  dataBase64: string
}

export interface AudioCaptureStateEvent {
  sessionId: string
  status: "started" | "stopped" | "error"
  message?: string | null
}

export interface AudioDevice {
  id: string
  name: string
  kind: "audioinput" | "audiooutput" | string
  isDefault: boolean
}

export const startAudioCaptureNative = (request: AudioCaptureRequest) =>
  invoke<string>("start_audio_capture", { request })

export const stopAudioCaptureNative = () => invoke<void>("stop_audio_capture")

export const getAudioDevicesNative = () => invoke<AudioDevice[]>("get_audio_devices")

export const onAudioCaptureFrame = async (
  handler: (frame: AudioCaptureFrame) => void,
): Promise<UnlistenFn> => {
  return listen<AudioCaptureFrame>("capture://audio/frame", (event) => {
    if (event.payload) {
      handler(event.payload)
    }
  })
}

export const onAudioCaptureState = async (
  handler: (event: AudioCaptureStateEvent) => void,
): Promise<UnlistenFn> => {
  return listen<AudioCaptureStateEvent>("capture://audio/state", (event) => {
    if (event.payload) {
      handler(event.payload)
    }
  })
}
