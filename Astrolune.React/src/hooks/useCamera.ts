import { useCallback, useMemo, useState } from "react"

import { startCameraNative, stopCameraNative } from "../lib/media"

export interface CameraStartOptions {
  deviceId?: string
  resolution?: [number, number]
  fps?: number
}

export interface UseCameraResult {
  active: boolean
  loading: boolean
  error: string | null
  start: (options?: CameraStartOptions) => Promise<void>
  stop: () => Promise<void>
}

export const useCamera = (): UseCameraResult => {
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async (options?: CameraStartOptions) => {
    setLoading(true)
    setError(null)
    try {
      await startCameraNative({
        deviceId: options?.deviceId,
        resolution: options?.resolution,
        fps: options?.fps,
      })
      setActive(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start camera"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const stop = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await stopCameraNative()
      setActive(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop camera"
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
      start,
      stop,
    }),
    [active, error, loading, start, stop],
  )
}
