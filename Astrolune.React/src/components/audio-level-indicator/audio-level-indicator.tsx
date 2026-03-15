"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import cn from "classnames"
import "./audio-level-indicator.scss"

interface AudioLevelIndicatorProps {
  deviceId?: string
  type: "input" | "output"
  isActive?: boolean
  barCount?: number
}

export const AudioLevelIndicator: React.FC<AudioLevelIndicatorProps> = ({
  deviceId,
  type,
  isActive = true,
  barCount = 20,
}) => {
  const [level, setLevel] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isActive || type !== "input") {
      setLevel(0)
      return
    }

    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        })

        audioContextRef.current = new AudioContext()
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256

        const source = audioContextRef.current.createMediaStreamSource(stream)
        source.connect(analyserRef.current)

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

        const updateLevel = () => {
          if (!analyserRef.current) return

          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          const normalizedLevel = Math.min(100, (average / 128) * 100)
          setLevel(normalizedLevel)

          animationRef.current = requestAnimationFrame(updateLevel)
        }

        updateLevel()
      } catch (error) {
        console.error("Failed to initialize audio:", error)
      }
    }

    initAudio()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [deviceId, isActive, type])

  const activeBars = Math.round((level / 100) * barCount)

  return (
    <div className="audio-level-indicator">
      {Array.from({ length: barCount }).map((_, index) => (
        <div
          key={index}
          className={cn("audio-level-indicator__bar", {
            "audio-level-indicator__bar--active": index < activeBars,
            "audio-level-indicator__bar--high": index >= barCount * 0.7,
            "audio-level-indicator__bar--medium": index >= barCount * 0.4 && index < barCount * 0.7,
          })}
        />
      ))}
    </div>
  )
}

export default AudioLevelIndicator
