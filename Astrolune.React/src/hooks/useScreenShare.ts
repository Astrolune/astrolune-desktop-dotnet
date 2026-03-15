import { useCallback, useEffect, useMemo, useState } from "react"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import {
  startScreenShareNative,
  stopScreenShareNative,
} from "../lib/media"

interface MediaCapabilitiesEvent {
  nvencAvailable?: boolean
  nvencError?: string | null
  dxgiAvailable?: boolean
  dxgiError?: string | null
}

export interface ScreenShareStartOptions {
  sourceId?: string
  resolution?: [number, number]
  cursor?: boolean
  fps?: number
  bitrateKbps?: number
}

export interface UseScreenShareResult {
  sharing: boolean
  loading: boolean
  error: string | null
  available: boolean
  unavailableReason: string | null
  start: (options?: ScreenShareStartOptions) => Promise<void>
  stop: () => Promise<void>
}

export const useScreenShare = (): UseScreenShareResult => {
  const [sharing, setSharing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState(true)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)

  useEffect(() => {
    let dispose: UnlistenFn | undefined

    const bind = async () => {
      try {
        dispose = await listen<MediaCapabilitiesEvent>("media://capabilities", (event) => {
          const payload = event.payload || {}
          const dxgiAvailable = payload.dxgiAvailable !== false
          setAvailable(dxgiAvailable)
          setUnavailableReason(
            dxgiAvailable
              ? null
              : payload.dxgiError ||
                  "Screen sharing is not available on this device",
          )
        })
      } catch {
        // Browser previews are not attached to a Tauri event bus.
        setAvailable(true)
        setUnavailableReason(null)
      }
    }

    void bind()
    return () => {
      if (dispose) {
        void dispose()
      }
    }
  }, [])

  const start = useCallback(
    async (options?: ScreenShareStartOptions) => {
      if (!available) {
        throw new Error(
          unavailableReason ||
            "Screen sharing is not available on this device",
        )
      }

      setLoading(true)
      setError(null)
      try {
        await startScreenShareNative({
          sourceId: options?.sourceId,
          resolution: options?.resolution,
          cursor: options?.cursor,
          fps: options?.fps,
          bitrateKbps: options?.bitrateKbps,
        })
        setSharing(true)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start screen share"
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [available, unavailableReason],
  )

  const stop = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await stopScreenShareNative()
      setSharing(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop screen share"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return useMemo(
    () => ({
      sharing,
      loading,
      error,
      available,
      unavailableReason,
      start,
      stop,
    }),
    [available, error, loading, sharing, start, stop, unavailableReason],
  )
}
