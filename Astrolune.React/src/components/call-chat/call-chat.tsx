// "use client"

// import type React from "react"
// import { useState, useCallback, useRef, useEffect } from "react"
// import { X, Send, Smile } from "lucide-react"
// import { useTranslation } from "react-i18next"
// import { useLiveKit } from "../../contexts/call-context"
// import cn from "classnames"
// import "./call-chat.scss"

// interface ChatMessage {
//   id: string
//   sender: string
//   senderName: string
//   text: string
//   timestamp: Date
//   isLocal: boolean
// }

// interface CallChatProps {
//   visible: boolean
//   onClose: () => void
//   roomName: string
// }

// export const CallChat: React.FC<CallChatProps> = ({ visible, onClose, roomName }) => {
//   const { t } = useTranslation("call")
//   const { room, localParticipant } = useLiveKit()
//   const [messages, setMessages] = useState<ChatMessage[]>([])
//   const [inputValue, setInputValue] = useState("")
//   const messagesEndRef = useRef<HTMLDivElement>(null)
//   const inputRef = useRef<HTMLInputElement>(null)

//   const scrollToBottom = useCallback(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
//   }, [])

//   useEffect(() => {
//     scrollToBottom()
//   }, [messages, scrollToBottom])

//   useEffect(() => {
//     if (!room) return

//     const handleDataReceived = (payload: Uint8Array, participant: any) => {
//       try {
//         const decoder = new TextDecoder()
//         const data = JSON.parse(decoder.decode(payload))

//         if (data.type === "chat") {
//           const newMessage: ChatMessage = {
//             id: `${Date.now()}-${Math.random()}`,
//             sender: participant?.identity || "unknown",
//             senderName: participant?.name || data.senderName || "Unknown",
//             text: data.text,
//             timestamp: new Date(),
//             isLocal: false,
//           }
//           setMessages((prev) => [...prev, newMessage])
//         }
//       } catch (e) {
//         console.error("Failed to parse chat message:", e)
//       }
//     }

//     room.on("dataReceived", handleDataReceived)
//     return () => {
//       room.off("dataReceived", handleDataReceived)
//     }
//   }, [room])

//   const handleSendMessage = useCallback(async () => {
//     if (!inputValue.trim() || !room || !localParticipant) return

//     const messageData = {
//       type: "chat",
//       text: inputValue.trim(),
//       senderName: localParticipant.name,
//       timestamp: Date.now(),
//     }

//     try {
//       const encoder = new TextEncoder()
//       const data = encoder.encode(JSON.stringify(messageData))
//       await room.localParticipant.publishData(data, { reliable: true })

//       const localMessage: ChatMessage = {
//         id: `${Date.now()}-${Math.random()}`,
//         sender: localParticipant.identity,
//         senderName: localParticipant.name,
//         text: inputValue.trim(),
//         timestamp: new Date(),
//         isLocal: true,
//       }
//       setMessages((prev) => [...prev, localMessage])
//       setInputValue("")
//     } catch (e) {
//       console.error("Failed to send message:", e)
//     }
//   }, [inputValue, room, localParticipant])

//   const handleKeyDown = useCallback(
//     (e: React.KeyboardEvent) => {
//       if (e.key === "Enter" && !e.shiftKey) {
//         e.preventDefault()
//         handleSendMessage()
//       }
//     },
//     [handleSendMessage],
//   )

//   const formatTime = (date: Date) => {
//     return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
//   }

//   if (!visible) return null

//   return (
//     <div className="call-chat">
//       <div className="call-chat__header">
//         <h3 className="call-chat__title">{t("chat") || "Chat"}</h3>
//         <span className="call-chat__room">{roomName}</span>
//         <button className="call-chat__close" onClick={onClose}>
//           <X size={18} />
//         </button>
//       </div>

//       <div className="call-chat__messages">
//         {messages.length === 0 ? (
//           <div className="call-chat__empty">
//             <p>{t("no_messages") || "No messages yet"}</p>
//             <span>{t("start_conversation") || "Start the conversation!"}</span>
//           </div>
//         ) : (
//           messages.map((message) => (
//             <div
//               key={message.id}
//               className={cn("call-chat__message", {
//                 "call-chat__message--local": message.isLocal,
//               })}
//             >
//               <div className="call-chat__message-header">
//                 <span className="call-chat__message-sender">{message.senderName}</span>
//                 <span className="call-chat__message-time">{formatTime(message.timestamp)}</span>
//               </div>
//               <p className="call-chat__message-text">{message.text}</p>
//             </div>
//           ))
//         )}
//         <div ref={messagesEndRef} />
//       </div>

//       <div className="call-chat__input-area">
//         <button className="call-chat__emoji-btn">
//           <Smile size={18} />
//         </button>
//         <input
//           ref={inputRef}
//           type="text"
//           className="call-chat__input"
//           placeholder={t("type_message") || "Type a message..."}
//           value={inputValue}
//           onChange={(e) => setInputValue(e.target.value)}
//           onKeyDown={handleKeyDown}
//         />
//         <button className="call-chat__send-btn" onClick={handleSendMessage} disabled={!inputValue.trim()}>
//           <Send size={18} />
//         </button>
//       </div>
//     </div>
//   )
// }

// export default CallChat
