import { useCallback, useEffect, useMemo, useState } from "react"
import {
  listAudioInputDevicesNative,
  startVoiceNative,
  stopVoiceNative,
  type AudioInputDevice,
} from "../lib/media"

export interface VoiceJoinOptions {
  inputDeviceId?: string
}

export interface UseVoiceResult {
  active: boolean
  loading: boolean
  error: string | null
  devices: AudioInputDevice[]
  join: (options?: VoiceJoinOptions) => Promise<void>
  leave: () => Promise<void>
  refreshDevices: () => Promise<void>
}

export const useVoice = (): UseVoiceResult => {
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<AudioInputDevice[]>([])

  const refreshDevices = useCallback(async () => {
    try {
      const nextDevices = await listAudioInputDevicesNative()
      setDevices(nextDevices)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list input devices"
      setError(message)
    }
  }, [])

  useEffect(() => {
    void refreshDevices()
  }, [refreshDevices])

  const join = useCallback(async (options?: VoiceJoinOptions) => {
    setLoading(true)
    setError(null)
    try {
      await startVoiceNative({
        inputDeviceId: options?.inputDeviceId,
      })
      setActive(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start voice"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const leave = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await stopVoiceNative()
      setActive(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop voice"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return useMemo(
    () => ({
      active,
      loading,
      error,
      devices,
      join,
      leave,
      refreshDevices,
    }),
    [active, devices, error, join, leave, loading, refreshDevices],
  )
}
