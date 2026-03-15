"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X, Mic, Camera, Wifi, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react"
import { Backdrop } from "../backdrop/backdrop"
import { Button } from "../button/button"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import "./device-test-modal.scss"

export interface DeviceTestResults {
  microphone: {
    tested: boolean
    working: boolean | null
    level: number
    error?: string
  }
  camera: {
    tested: boolean
    working: boolean | null
    stream: MediaStream | null
    error?: string
  }
  network: {
    tested: boolean
    pingMs: number | null
    jitterMs: number | null
    packetLossPercent: number | null
    quality: "excellent" | "good" | "fair" | "poor" | "unknown"
    error?: string
  }
}

interface DeviceTestModalProps {
  visible: boolean
  onClose: () => void
}

const INITIAL_RESULTS: DeviceTestResults = {
  microphone: { tested: false, working: null, level: 0 },
  camera: { tested: false, working: null, stream: null },
  network: { tested: false, pingMs: null, jitterMs: null, packetLossPercent: null, quality: "unknown" },
}

export const DeviceTestModal: React.FC<DeviceTestModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation(["settings", "modal"])
  const [isClosing, setIsClosing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [results, setResults] = useState<DeviceTestResults>(INITIAL_RESULTS)
  const [currentTest, setCurrentTest] = useState<"mic" | "camera" | "network" | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
      setIsClosing(false)
      // Cleanup on close
      cleanupAudio()
      cleanupVideo()
      setResults(INITIAL_RESULTS)
    }, 200)
  }, [onClose])

  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
  }, [])

  const cleanupVideo = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [visible, handleClose])

  useEffect(() => {
    return () => {
      cleanupAudio()
      cleanupVideo()
    }
  }, [cleanupAudio, cleanupVideo])

  const testMicrophone = useCallback(async () => {
    setCurrentTest("mic")
    setResults(prev => ({ ...prev, microphone: { tested: false, working: null, level: 0 } }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      const measureLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const normalizedLevel = Math.min(100, (average / 255) * 100)

        setResults(prev => ({
          ...prev,
          microphone: {
            tested: true,
            working: normalizedLevel > 1,
            level: normalizedLevel,
          },
        }))

        animationFrameRef.current = requestAnimationFrame(measureLevel)
      }

      measureLevel()

      // Test for 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000))
      cleanupAudio()
      stream.getTracks().forEach(track => track.stop())

      setResults(prev => ({
        ...prev,
        microphone: {
          tested: true,
          working: prev.microphone.level > 1,
          level: prev.microphone.level,
        },
      }))
    } catch (error) {
      cleanupAudio()
      setResults(prev => ({
        ...prev,
        microphone: {
          tested: true,
          working: false,
          level: 0,
          error: error instanceof Error ? error.message : "Failed to access microphone",
        },
      }))
    } finally {
      setCurrentTest(null)
    }
  }, [cleanupAudio])

  const testCamera = useCallback(async () => {
    setCurrentTest("camera")
    setResults(prev => ({ ...prev, camera: { tested: false, working: null, stream: null } }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 } 
      })

      setResults(prev => ({
        ...prev,
        camera: {
          tested: true,
          working: true,
          stream,
        },
      }))

      // Display stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // Test for 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      cleanupVideo()
      setResults(prev => ({
        ...prev,
        camera: {
          tested: true,
          working: true,
          stream: null,
        },
      }))
    } catch (error) {
      cleanupVideo()
      setResults(prev => ({
        ...prev,
        camera: {
          tested: true,
          working: false,
          stream: null,
          error: error instanceof Error ? error.message : "Failed to access camera",
        },
      }))
    } finally {
      setCurrentTest(null)
    }
  }, [cleanupVideo])

  const testNetwork = useCallback(async () => {
    setCurrentTest("network")
    setResults(prev => ({ ...prev, network: { 
      tested: false, 
      pingMs: null, 
      jitterMs: null, 
      packetLossPercent: null, 
      quality: "unknown" 
    }}))

    try {
      const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:3001"
      const pingResults: number[] = []
      const iterations = 5

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        try {
          await fetch(`${apiUrl}/health`, { 
            method: "GET",
            cache: "no-cache",
          })
          const end = performance.now()
          pingResults.push(end - start)
        } catch {
          // Request failed, treat as high latency
          pingResults.push(1000)
        }
      }

      if (pingResults.length === 0) {
        throw new Error("No ping results")
      }

      const avgPing = pingResults.reduce((a, b) => a + b, 0) / pingResults.length
      const minPing = Math.min(...pingResults)
      const jitter = avgPing - minPing

      // Estimate packet loss based on failed requests
      const failedRequests = pingResults.filter(r => r >= 1000).length
      const packetLoss = (failedRequests / iterations) * 100

      // Determine quality
      let quality: DeviceTestResults["network"]["quality"] = "unknown"
      if (avgPing < 50 && jitter < 10 && packetLoss < 0.1) {
        quality = "excellent"
      } else if (avgPing < 100 && jitter < 30 && packetLoss < 1) {
        quality = "good"
      } else if (avgPing < 200 && jitter < 50 && packetLoss < 3) {
        quality = "fair"
      } else {
        quality = "poor"
      }

      setResults(prev => ({
        ...prev,
        network: {
          tested: true,
          pingMs: Math.round(avgPing),
          jitterMs: Math.round(jitter),
          packetLossPercent: Math.round(packetLoss * 100) / 100,
          quality,
        },
      }))
    } catch (error) {
      setResults(prev => ({
        ...prev,
        network: {
          tested: true,
          pingMs: null,
          jitterMs: null,
          packetLossPercent: null,
          quality: "unknown",
          error: error instanceof Error ? error.message : "Failed to test network",
        },
      }))
    } finally {
      setCurrentTest(null)
    }
  }, [])

  const runAllTests = useCallback(async () => {
    setIsTesting(true)
    await testMicrophone()
    await testCamera()
    await testNetwork()
    setIsTesting(false)
  }, [testMicrophone, testCamera, testNetwork])

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "excellent": return "text-green-500"
      case "good": return "text-blue-500"
      case "fair": return "text-yellow-500"
      case "poor": return "text-red-500"
      default: return "text-gray-500"
    }
  }

  if (!visible) return null

  return createPortal(
    <Backdrop isClosing={isClosing} onClick={handleClose}>
      <div 
        className={cn("device-test-modal", { "device-test-modal--closing": isClosing })}
        role="dialog"
        aria-labelledby="device-test-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="device-test-modal__header">
          <h3 id="device-test-title" className="device-test-modal__title">
            {t("settings:device_tests")}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="device-test-modal__close"
            aria-label={t("modal:close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="device-test-modal__content">
          {/* Microphone Test */}
          <div className="device-test-modal__section">
            <div className="device-test-modal__section-header">
              <div className="device-test-modal__section-icon">
                <Mic size={20} />
              </div>
              <span className="device-test-modal__section-title">{t("settings:microphone_test")}</span>
              {results.microphone.tested && (
                <span className="device-test-modal__status">
                  {results.microphone.working ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <XCircle size={18} className="text-red-500" />
                  )}
                </span>
              )}
            </div>

            {results.microphone.tested && results.microphone.working && (
              <div className="device-test-modal__audio-level">
                <div className="device-test-modal__audio-bar">
                  <div 
                    className="device-test-modal__audio-fill" 
                    style={{ width: `${results.microphone.level}%` }}
                  />
                </div>
                <span className="device-test-modal__audio-value">{Math.round(results.microphone.level)}%</span>
              </div>
            )}

            {results.microphone.error && (
              <p className="device-test-modal__error">{results.microphone.error}</p>
            )}
          </div>

          {/* Camera Test */}
          <div className="device-test-modal__section">
            <div className="device-test-modal__section-header">
              <div className="device-test-modal__section-icon">
                <Camera size={20} />
              </div>
              <span className="device-test-modal__section-title">{t("settings:camera_test")}</span>
              {results.camera.tested && (
                <span className="device-test-modal__status">
                  {results.camera.working ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : (
                    <XCircle size={18} className="text-red-500" />
                  )}
                </span>
              )}
            </div>

            {results.camera.stream && (
              <div className="device-test-modal__video-preview">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="device-test-modal__video"
                />
              </div>
            )}

            {results.camera.error && (
              <p className="device-test-modal__error">{results.camera.error}</p>
            )}
          </div>

          {/* Network Test */}
          <div className="device-test-modal__section">
            <div className="device-test-modal__section-header">
              <div className="device-test-modal__section-icon">
                <Wifi size={20} />
              </div>
              <span className="device-test-modal__section-title">{t("settings:network_test")}</span>
              {results.network.tested && (
                <span className={cn("device-test-modal__status", getQualityColor(results.network.quality))}>
                  {results.network.quality === "excellent" || results.network.quality === "good" ? (
                    <CheckCircle size={18} />
                  ) : results.network.quality === "poor" ? (
                    <XCircle size={18} />
                  ) : null}
                </span>
              )}
            </div>

            {results.network.tested && (
              <div className="device-test-modal__network-stats">
                <div className="device-test-modal__stat">
                  <span className="device-test-modal__stat-label">{t("settings:ping")}</span>
                  <span className="device-test-modal__stat-value">
                    {results.network.pingMs ?? "-"} ms
                  </span>
                </div>
                <div className="device-test-modal__stat">
                  <span className="device-test-modal__stat-label">{t("settings:jitter")}</span>
                  <span className="device-test-modal__stat-value">
                    {results.network.jitterMs ?? "-"} ms
                  </span>
                </div>
                <div className="device-test-modal__stat">
                  <span className="device-test-modal__stat-label">{t("settings:packet_loss")}</span>
                  <span className="device-test-modal__stat-value">
                    {results.network.packetLossPercent ?? "-"}%
                  </span>
                </div>
                <div className="device-test-modal__stat">
                  <span className="device-test-modal__stat-label">{t("settings:quality")}</span>
                  <span className={cn("device-test-modal__stat-value", getQualityColor(results.network.quality))}>
                    {t(`settings:quality_${results.network.quality}`)}
                  </span>
                </div>
              </div>
            )}

            {results.network.error && (
              <p className="device-test-modal__error">{results.network.error}</p>
            )}
          </div>
        </div>

        <div className="device-test-modal__footer">
          <Button 
            theme="outline" 
            onClick={runAllTests}
            disabled={isTesting}
          >
            {isTesting ? (
              <>
                <Loader2 size={16} className="spin" />
                {t("settings:testing")}
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                {t("settings:run_tests")}
              </>
            )}
          </Button>
          <Button theme="primary" onClick={handleClose}>
            {t("modal:done")}
          </Button>
        </div>
      </div>
    </Backdrop>,
    document.body
  )
}

export default DeviceTestModal
