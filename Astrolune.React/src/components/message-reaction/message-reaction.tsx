import type React from "react"
import "./message-reaction.scss"

interface MessageReactionProps {
  emoji: string
  count: number
  active?: boolean
  onClick?: () => void
}

export const MessageReaction: React.FC<MessageReactionProps> = ({ emoji, count, active = false, onClick }) => {
  return (
    <div className={`message-reaction ${active ? "message-reaction--active" : ""}`} onClick={onClick}>
      <span className="message-reaction__emoji">{emoji}</span>
      <span className="message-reaction__count">{count}</span>
    </div>
  )
}
