"use client"

import type React from "react"
import { useEffect, useRef, memo } from "react"
import type { TrackPublication } from "livekit-client"
import cn from "classnames"
import "./livekit-video.scss"

interface LiveKitVideoProps {
  track: TrackPublication | undefined
  className?: string
  objectFit?: "cover" | "contain"
  mirror?: boolean
}

export const LiveKitVideo: React.FC<LiveKitVideoProps> = memo(
  ({ track, className, objectFit = "cover", mirror = false }) => {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
      const videoElement = videoRef.current
      if (!videoElement || !track?.track) return

      track.track.attach(videoElement)

      return () => {
        track.track?.detach(videoElement)
      }
    }, [track])

    if (!track?.track) {
      return null
    }

    return (
      <video
        ref={videoRef}
        className={cn("livekit-video", className, {
          "livekit-video--mirror": mirror,
          "livekit-video--cover": objectFit === "cover",
          "livekit-video--contain": objectFit === "contain",
        })}
        autoPlay
        playsInline
        muted
      />
    )
  },
)

LiveKitVideo.displayName = "LiveKitVideo"
