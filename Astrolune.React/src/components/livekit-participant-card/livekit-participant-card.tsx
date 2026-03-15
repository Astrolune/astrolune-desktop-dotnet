// "use client"

// import type React from "react"
// import { memo, useCallback, useState, useEffect } from "react"
// import {
//   Mic,
//   MicOff,
//   Video,
//   VideoOff,
//   Monitor,
//   Pin,
//   Maximize2,
//   Minimize2,
//   User,
//   Wifi,
//   WifiIcon as WifiLow,
// } from "lucide-react"
// import type { ParticipantInfo } from "../../contexts/call-context"
// import { LiveKitVideo } from "../livekit-video/livekit-video"
// import { LiveKitAudio } from "../livekit-audio/livekit-audio"
// import cn from "classnames"
// import "./livekit-participant-card.scss"

// interface LiveKitParticipantCardProps {
//   participant: ParticipantInfo
//   isExpanded?: boolean
//   isPinned?: boolean
//   onExpand?: (id: string) => void
//   onPin?: (id: string) => void
//   size?: "small" | "medium" | "large"
// }

// export const LiveKitParticipantCard: React.FC<LiveKitParticipantCardProps> = memo(
//   ({ participant, isExpanded = false, isPinned = false, onExpand, onPin, size = "medium" }) => {
//     const {
//       id,
//       name,
//       isSpeaking,
//       isMuted,
//       isCameraOn,
//       isScreenSharing,
//       connectionQuality,
//       audioLevel,
//       videoTrack,
//       audioTrack,
//       screenShareTrack,
//       isLocal,
//     } = participant

//     const [isCurrentlySpeaking, setIsCurrentlySpeaking] = useState(false)

//     useEffect(() => {
//       // Update speaking state when audio level changes
//       const speaking = isSpeaking && audioLevel > 0.01 && !isMuted
//       setIsCurrentlySpeaking(speaking)
//     }, [isSpeaking, audioLevel, isMuted])

//     const handleExpand = useCallback(() => {
//       onExpand?.(id)
//     }, [id, onExpand])

//     const handlePin = useCallback(
//       (e: React.MouseEvent) => {
//         e.stopPropagation()
//         onPin?.(id)
//       },
//       [id, onPin],
//     )

//     const displayTrack = isScreenSharing ? screenShareTrack : videoTrack
//     const showVideo = isCameraOn || isScreenSharing

//     const getQualityIcon = () => {
//       switch (connectionQuality) {
//         case "excellent":
//         case "good":
//           return <Wifi size={12} />
//         case "poor":
//           return <WifiLow size={12} />
//         default:
//           return <WifiLow size={12} />
//       }
//     }

//     return (
//       <div
//         className={cn("lk-participant-card", `lk-participant-card--${size}`, {
//           "lk-participant-card--speaking": isCurrentlySpeaking,
//           "lk-participant-card--expanded": isExpanded,
//           "lk-participant-card--pinned": isPinned,
//           "lk-participant-card--local": isLocal,
//           "lk-participant-card--screen-sharing": isScreenSharing,
//         })}
//         onClick={handleExpand}
//       >
//         {isCurrentlySpeaking && (
//           <div
//             className="lk-participant-card__speaking-border"
//             style={{
//               opacity: Math.min(1, 0.5 + audioLevel * 2),
//             }}
//           />
//         )}

//         <div className="lk-participant-card__video">
//           {showVideo && displayTrack ? (
//             <LiveKitVideo
//               track={displayTrack}
//               mirror={isLocal && !isScreenSharing}
//               objectFit={isScreenSharing ? "contain" : "cover"}
//             />
//           ) : (
//             <div className="lk-participant-card__avatar">
//               <div className="lk-participant-card__avatar-circle">
//                 <User size={size === "small" ? 24 : size === "medium" ? 40 : 64} />
//               </div>
//             </div>
//           )}
//         </div>

//         {!isLocal && audioTrack && <LiveKitAudio track={audioTrack} muted={false} />}

//         <div className="lk-participant-card__overlay">
//           <div className="lk-participant-card__actions">
//             <button
//               className={cn("lk-participant-card__action", { "lk-participant-card__action--active": isPinned })}
//               onClick={handlePin}
//               title="Pin"
//             >
//               <Pin size={14} />
//             </button>
//             <button
//               className="lk-participant-card__action"
//               onClick={handleExpand}
//               title={isExpanded ? "Collapse" : "Expand"}
//             >
//               {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
//             </button>
//           </div>

//           <div className="lk-participant-card__info">
//             <div className="lk-participant-card__name">
//               {name}
//               {isLocal && <span className="lk-participant-card__local-badge">(You)</span>}
//             </div>
//             <div className="lk-participant-card__indicators">
//               <span
//                 className={cn("lk-participant-card__quality", `lk-participant-card__quality--${connectionQuality}`)}
//               >
//                 {getQualityIcon()}
//               </span>
//               {isScreenSharing && (
//                 <span className="lk-participant-card__indicator lk-participant-card__indicator--screen">
//                   <Monitor size={12} />
//                 </span>
//               )}
//               <span
//                 className={cn("lk-participant-card__indicator", { "lk-participant-card__indicator--off": !isCameraOn })}
//               >
//                 {isCameraOn ? <Video size={12} /> : <VideoOff size={12} />}
//               </span>
//               <span
//                 className={cn("lk-participant-card__indicator", { "lk-participant-card__indicator--off": isMuted })}
//               >
//                 {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
//               </span>
//             </div>
//           </div>
//         </div>
//       </div>
//     )
//   },
// )

// LiveKitParticipantCard.displayName = "LiveKitParticipantCard"
