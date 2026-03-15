export interface MessageReaction {
  userId: string
  emoji: string
  count: number
}

export interface PollOption {
  id: string
  text: string
  votes: string[]
}

export interface ChatMessage {
  id: string
  senderId: string
  text: string
  timestamp: number
  reactions: MessageReaction[]
  isPoll?: boolean
  pollOptions?: PollOption[]
  isEdited?: boolean
  replyTo?: string
  deliveryStatus?: "sending" | "sent" | "delivered" | "read" | "failed"
}

export interface MediaContent {
  type: "image" | "video" | "audio" | "file"
  url: string
  name?: string
  alt?: string
  size?: number
  mimeType?: string
}

export interface Conversation {
  id: string
  participantIds: string[]
  lastMessage?: ChatMessage
  unreadCount: number
  createdAt: string
  updatedAt: string
}
