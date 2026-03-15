"use client"

import type React from "react"
import { useEffect, useRef, memo } from "react"
type TrackPublicationLike = {
  track?: {
    attach?: (element?: HTMLMediaElement) => HTMLMediaElement | HTMLMediaElement[]
    detach?: (element?: HTMLMediaElement) => HTMLMediaElement[]
  } | null
}

interface LiveKitAudioProps {
  track: TrackPublicationLike | null | undefined
  volume?: number
  muted?: boolean
}

export const LiveKitAudio: React.FC<LiveKitAudioProps> = memo(({ track, volume = 1, muted = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audioElement = audioRef.current
    if (!audioElement || !track?.track) return

    track.track.attach?.(audioElement)

    return () => {
      track.track?.detach?.(audioElement)
    }
  }, [track])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      audioRef.current.muted = muted
    }
  }, [volume, muted])

  if (!track?.track) {
    return null
  }

  return <audio ref={audioRef} autoPlay />
})

LiveKitAudio.displayName = "LiveKitAudio"
