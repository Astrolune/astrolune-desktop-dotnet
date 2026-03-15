import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Activity, Monitor, RefreshCw, Square, Play, PhoneCall, PhoneOff, ExternalLink } from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  getCaptureSources,
  startScreenCapture,
  stopScreenCapture,
  getCaptureStats,
  type CaptureOptions,
  type CaptureSource,
  type CaptureStats,
} from "../../lib/capture"
import { useCall } from "../../contexts/call-context"
import { CURRENT_USER } from "../../constants"
import "./capture-tester.scss"

type QualityLevel = "Excellent" | "Good" | "Fair" | "Poor"

const RESOLUTION_PRESETS: Array<{ label: string; value: [number, number] }> = [
  { label: "1280x720 (HD)", value: [1280, 720] },
  { label: "1920x1080 (Full HD)", value: [1920, 1080] },
  { label: "2560x1440 (2K)", value: [2560, 1440] },
  { label: "3840x2160 (4K)", value: [3840, 2160] },
]

const QUALITY_STYLES: Record<QualityLevel, string> = {
  Excellent: "capture-tester__quality--excellent",
  Good: "capture-tester__quality--good",
  Fair: "capture-tester__quality--fair",
  Poor: "capture-tester__quality--poor",
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

const estimateExpectedBitrateKbps = (resolution: [number, number], fps: number) => {
  const pixelsPerSecond = resolution[0] * resolution[1] * fps
  return Math.max(700, Math.round(pixelsPerSecond / 22_000))
}

const evaluateQuality = (
  stats: CaptureStats,
  targetFps: number,
  targetResolution: [number, number],
): { label: QualityLevel; score: number; expectedBitrateKbps: number } => {
  const fpsScore = clamp(stats.fps_actual / Math.max(1, targetFps), 0, 1)
  const expectedBitrateKbps = estimateExpectedBitrateKbps(targetResolution, targetFps)
  const bitrateScore = clamp(stats.bitrate_kbps / Math.max(1, expectedBitrateKbps), 0, 1)

  let dropPenalty = 0
  if (stats.dropped_frames >= 80) {
    dropPenalty = 0.35
  } else if (stats.dropped_frames >= 30) {
    dropPenalty = 0.2
  } else if (stats.dropped_frames >= 10) {
    dropPenalty = 0.1
  }

  const score = clamp(fpsScore * 0.65 + bitrateScore * 0.35 - dropPenalty, 0, 1)

  if (score >= 0.85) return { label: "Excellent", score, expectedBitrateKbps }
  if (score >= 0.7) return { label: "Good", score, expectedBitrateKbps }
  if (score >= 0.5) return { label: "Fair", score, expectedBitrateKbps }
  return { label: "Poor", score, expectedBitrateKbps }
}

export const CaptureTesterPage: React.FC = () => {
  const navigate = useNavigate()
  const {
    isConnected: isCallConnected,
    isConnecting: isCallConnecting,
    roomName: connectedRoomName,
    connect: connectCall,
    disconnect: disconnectCall,
  } = useCall()

  const [sources, setSources] = useState<CaptureSource[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string>("")
  const [options, setOptions] = useState<CaptureOptions>({
    fps: 60,
    resolution: RESOLUTION_PRESETS[1].value,
    cursor: true,
    hdr: false,
  })

  const [isLoadingSources, setIsLoadingSources] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [stats, setStats] = useState<CaptureStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [createdRoomName, setCreatedRoomName] = useState("")
  const [isStartingCall, setIsStartingCall] = useState(false)
  const [isStoppingCall, setIsStoppingCall] = useState(false)
  const [callError, setCallError] = useState<string | null>(null)

  const sessionRef = useRef<string | null>(null)

  useEffect(() => {
    sessionRef.current = sessionId
  }, [sessionId])

  const loadSources = useCallback(async () => {
    setIsLoadingSources(true)
    setError(null)

    try {
      const nextSources = await getCaptureSources()
      setSources(nextSources)
      if (!selectedSourceId && nextSources.length > 0) {
        setSelectedSourceId(nextSources[0].id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load capture sources"
      setError(message)
    } finally {
      setIsLoadingSources(false)
    }
  }, [selectedSourceId])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  const stopActiveSession = useCallback(async () => {
    const activeSessionId = sessionRef.current
    if (!activeSessionId) return

    await stopScreenCapture(activeSessionId)
    setSessionId(null)
    setStats(null)
  }, [])

  useEffect(() => {
    return () => {
      void stopActiveSession()
    }
  }, [stopActiveSession])

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false

    const pollStats = async () => {
      try {
        const nextStats = await getCaptureStats(sessionId)
        if (!cancelled) {
          setStats(nextStats)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to fetch capture stats"
          setError(message)
        }
      }
    }

    void pollStats()
    const timer = window.setInterval(() => {
      void pollStats()
    }, 500)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sessionId])

  const startCapture = useCallback(async () => {
    if (!selectedSourceId || sessionId) return

    setIsStarting(true)
    setError(null)

    try {
      const nextSessionId = await startScreenCapture(selectedSourceId, options)
      setSessionId(nextSessionId)
      setStats(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start capture"
      setError(message)
    } finally {
      setIsStarting(false)
    }
  }, [options, selectedSourceId, sessionId])

  const stopCapture = useCallback(async () => {
    if (!sessionId) return

    setIsStopping(true)
    setError(null)

    try {
      await stopScreenCapture(sessionId)
      setSessionId(null)
      setStats(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop capture"
      setError(message)
    } finally {
      setIsStopping(false)
    }
  }, [sessionId])

  const startDemoCall = useCallback(async () => {
    if (isCallConnected || isCallConnecting || isStartingCall) return

    setCallError(null)
    setIsStartingCall(true)

    const roomName = `capture-demo-${Date.now().toString(36)}`
    const userName = CURRENT_USER.nickname.trim() || "Capture Tester"
    const identity = `capture_tester_${Date.now()}`

    try {
      await connectCall(roomName, identity, userName)
      setCreatedRoomName(roomName)
      navigate(`/call/${roomName}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start demo call"
      setCallError(message)
    } finally {
      setIsStartingCall(false)
    }
  }, [connectCall, isCallConnected, isCallConnecting, isStartingCall, navigate])

  const stopDemoCall = useCallback(async () => {
    if (!isCallConnected) return

    setCallError(null)
    setIsStoppingCall(true)

    try {
      await disconnectCall()
      setCreatedRoomName("")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop demo call"
      setCallError(message)
    } finally {
      setIsStoppingCall(false)
    }
  }, [disconnectCall, isCallConnected])

  const activeRoomName = connectedRoomName || createdRoomName

  const openDemoCall = useCallback(() => {
    if (!activeRoomName) return
    navigate(`/call/${activeRoomName}`)
  }, [activeRoomName, navigate])

  const currentQuality = useMemo(() => {
    if (!stats) return null
    return evaluateQuality(stats, options.fps, options.resolution)
  }, [stats, options.fps, options.resolution])

  const monitors = useMemo(() => sources.filter((source) => source.kind === "monitor"), [sources])
  const windows = useMemo(() => sources.filter((source) => source.kind === "window"), [sources])

  return (
    <div className="capture-tester">
      <header className="capture-tester__header">
        <div>
          <h1>Capture Tester</h1>
          <p>Validate FPS, bitrate, and overall screen capture quality.</p>
        </div>

        <button
          type="button"
          className="capture-tester__refresh"
          onClick={() => void loadSources()}
          disabled={isLoadingSources}
        >
          <RefreshCw size={16} className={isLoadingSources ? "capture-tester__spin" : ""} />
          Refresh Sources
        </button>
      </header>

      <section className="capture-tester__controls">
        <label>
          FPS
          <select
            value={options.fps}
            onChange={(event) => {
              const fps = Number(event.target.value) as 30 | 60
              setOptions((prev) => ({ ...prev, fps }))
            }}
            disabled={!!sessionId}
          >
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>

        <label>
          Resolution
          <select
            value={`${options.resolution[0]}x${options.resolution[1]}`}
            onChange={(event) => {
              const [width, height] = event.target.value.split("x").map(Number)
              setOptions((prev) => ({ ...prev, resolution: [width, height] }))
            }}
            disabled={!!sessionId}
          >
            {RESOLUTION_PRESETS.map((preset) => (
              <option key={preset.label} value={`${preset.value[0]}x${preset.value[1]}`}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="capture-tester__toggle">
          <input
            type="checkbox"
            checked={options.cursor}
            onChange={(event) => setOptions((prev) => ({ ...prev, cursor: event.target.checked }))}
            disabled={!!sessionId}
          />
          Cursor
        </label>

        <label className="capture-tester__toggle">
          <input
            type="checkbox"
            checked={options.hdr}
            onChange={(event) => setOptions((prev) => ({ ...prev, hdr: event.target.checked }))}
            disabled={!!sessionId}
          />
          HDR
        </label>
      </section>

      {(error || callError) && <div className="capture-tester__error">{error ?? callError}</div>}

      <section className="capture-tester__sources">
        <div className="capture-tester__source-column">
          <h2>
            <Monitor size={16} /> Monitors ({monitors.length})
          </h2>
          <div className="capture-tester__source-list">
            {monitors.map((source) => (
              <button
                type="button"
                key={source.id}
                className={source.id === selectedSourceId ? "is-selected" : ""}
                onClick={() => setSelectedSourceId(source.id)}
                disabled={!!sessionId}
              >
                <span>{source.name}</span>
                <small>
                  {source.width}x{source.height}
                </small>
              </button>
            ))}
          </div>
        </div>

        <div className="capture-tester__source-column">
          <h2>
            <Activity size={16} /> Windows ({windows.length})
          </h2>
          <div className="capture-tester__source-list">
            {windows.map((source) => (
              <button
                type="button"
                key={source.id}
                className={source.id === selectedSourceId ? "is-selected" : ""}
                onClick={() => setSelectedSourceId(source.id)}
                disabled={!!sessionId}
              >
                <span>{source.name}</span>
                <small>
                  {source.width}x{source.height}
                </small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="capture-tester__session">
        <div className="capture-tester__actions">
          <button
            type="button"
            className="capture-tester__btn capture-tester__btn--call-start"
            onClick={() => void startDemoCall()}
            disabled={isCallConnected || isCallConnecting || isStartingCall}
          >
            <PhoneCall size={16} /> {isCallConnecting || isStartingCall ? "Connecting..." : "Start Call"}
          </button>

          <button
            type="button"
            className="capture-tester__btn capture-tester__btn--call-open"
            onClick={openDemoCall}
            disabled={!activeRoomName}
          >
            <ExternalLink size={16} /> Open Call
          </button>

          <button
            type="button"
            className="capture-tester__btn capture-tester__btn--call-stop"
            onClick={() => void stopDemoCall()}
            disabled={!isCallConnected || isStoppingCall}
          >
            <PhoneOff size={16} /> {isStoppingCall ? "Ending..." : "End Call"}
          </button>

          <button
            type="button"
            className="capture-tester__btn capture-tester__btn--start"
            onClick={() => void startCapture()}
            disabled={!selectedSourceId || !!sessionId || isStarting}
          >
            <Play size={16} /> {isStarting ? "Starting..." : "Start Capture"}
          </button>

          <button
            type="button"
            className="capture-tester__btn capture-tester__btn--stop"
            onClick={() => void stopCapture()}
            disabled={!sessionId || isStopping}
          >
            <Square size={16} /> {isStopping ? "Stopping..." : "Stop Capture"}
          </button>
        </div>

        <div className="capture-tester__stats">
          <div>
            <label>Call State</label>
            <p>{isCallConnected ? "connected" : isCallConnecting ? "connecting" : "disconnected"}</p>
          </div>

          <div>
            <label>Call Room</label>
            <p>{activeRoomName || "-"}</p>
          </div>

          <div>
            <label>Session</label>
            <p>{sessionId ?? "not running"}</p>
          </div>

          <div>
            <label>FPS (actual)</label>
            <p>{stats ? stats.fps_actual.toFixed(1) : "-"}</p>
          </div>

          <div>
            <label>Bitrate</label>
            <p>{stats ? `${stats.bitrate_kbps} kbps` : "-"}</p>
          </div>

          <div>
            <label>Dropped Frames</label>
            <p>{stats ? stats.dropped_frames : "-"}</p>
          </div>

          <div>
            <label>Encoder</label>
            <p>{stats ? stats.encoder : "-"}</p>
          </div>

          <div>
            <label>Resolution</label>
            <p>{stats ? `${stats.resolution[0]}x${stats.resolution[1]}` : "-"}</p>
          </div>
        </div>

        <div className={`capture-tester__quality ${currentQuality ? QUALITY_STYLES[currentQuality.label] : ""}`}>
          <h3>Quality</h3>
          {currentQuality ? (
            <>
              <strong>{currentQuality.label}</strong>
              <p>Score: {(currentQuality.score * 100).toFixed(0)} / 100</p>
              <p>Expected bitrate: ~{currentQuality.expectedBitrateKbps} kbps</p>
            </>
          ) : (
            <p>Start capture to evaluate quality.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export default CaptureTesterPage