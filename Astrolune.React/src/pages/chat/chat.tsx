"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Send, Plus, Smile, Gift, Sticker, MessageCircle, MoreHorizontal, Reply, Phone } from "lucide-react"
import { Avatar } from "../../components/avatar/avatar"
import { InCallPanel } from "../../components/in-call-panel/in-call-panel"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import type { ChatMessage, UserData } from "../../types"
import { useCall } from "../../contexts/call-context"
import { useAuthSession } from "../../contexts/auth-context"
import { toUserData } from "../../lib/auth/user-data"
import { api, type MessageDto, type UserProfileDto } from "../../lib/api-client"
import { getRealtimeClient, type RealtimeEventMessage } from "../../lib/realtime-client"
import { HeaderChat } from "../../components/header/header"
import { useToast } from "../../hooks/useToast"
import "./chat.scss"

interface ChatPageProps {
  currentUser?: UserData
}

interface IncomingCallState {
  callerId: string
  callerName: string
  startedAt: number
}

const TYPING_INDICATOR_TTL_MS = 3500

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const readString = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return ""
}

const toUnixMs = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  return Date.now()
}

const mapReactions = (reactions: Record<string, string[]>): ChatMessage["reactions"] =>
  Object.entries(reactions).map(([emoji, userIds]) => ({
    emoji,
    userId: userIds[0] || "",
    count: userIds.length,
  }))

const mapMessageDto = (message: MessageDto, deliveryStatus: ChatMessage["deliveryStatus"] = "delivered"): ChatMessage => {
  return {
    id: message.messageId,
    senderId: message.authorId,
    text: message.isDeleted ? "[deleted]" : message.content,
    timestamp: toUnixMs(message.createdAt),
    reactions: mapReactions(message.reactions || {}),
    isEdited: Boolean(message.editedAt),
    deliveryStatus,
  }
}

const isChannelEvent = (event: RealtimeEventMessage, channelId: string) => {
  if (!isRecord(event.data)) {
    return false
  }

  const eventChannelId = readString(event.data, "channel_id", "channelId")
  return eventChannelId === channelId
}

export const ChatPage: React.FC<ChatPageProps> = ({ currentUser }) => {
  const { user: authUser } = useAuthSession()
  const { showErrorToast } = useToast()
  const resolvedCurrentUser = currentUser ?? toUserData(authUser)
  const { chatId } = useParams<{ chatId?: string }>()
  const { t } = useTranslation("chat")

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [profilesById, setProfilesById] = useState<Record<string, UserProfileDto | null>>({})
  const [channelName, setChannelName] = useState<string>("")
  const [inputValue, setInputValue] = useState("")
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typingByUserId, setTypingByUserId] = useState<Map<string, number>>(new Map())
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null)
  const [callDuration, setCallDuration] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const profileCacheRef = useRef<Record<string, UserProfileDto | null>>({})
  const typingLastSentAtRef = useRef<number>(0)

  const {
    isConnected,
    roomName,
    isMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    participants: callParticipants,
    toggleMicrophone,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    connect,
    disconnect,
  } = useCall()

  const isCallInCurrentChat = Boolean(chatId && isConnected && roomName === chatId)

  useEffect(() => {
    profileCacheRef.current = profilesById
  }, [profilesById])

  const ensureProfiles = useCallback(async (userIds: string[]) => {
    const uniqueIds = Array.from(new Set(userIds.filter((value) => Boolean(value.trim()))))
    const missingIds = uniqueIds.filter((userId) => !(userId in profileCacheRef.current))
    if (missingIds.length === 0) {
      return
    }

    const loaded = await Promise.all(
      missingIds.map(async (userId) => {
        try {
          const profile = await api.users.getById(userId)
          return [userId, profile] as const
        } catch {
          return [userId, null] as const
        }
      }),
    )

    setProfilesById((previous) => {
      const next = { ...previous }
      for (const [userId, profile] of loaded) {
        next[userId] = profile
      }
      return next
    })
  }, [])

  const loadChannelName = useCallback(async (activeChatId: string) => {
    const guilds = await api.guilds.list()
    for (const guild of guilds) {
      const channels = await api.guilds.listChannels(guild.id)
      const matched = channels.find((channel) => channel.id === activeChatId)
      if (matched) {
        return `#${matched.name}`
      }
    }
    return `#${activeChatId.slice(0, 8)}`
  }, [])

  const loadChannelHistory = useCallback(
    async (activeChatId: string) => {
      setLoadingHistory(true)
      setError(null)
      try {
        const [history, resolvedChannelName] = await Promise.all([
          api.messages.listChannelMessages(activeChatId, 100),
          loadChannelName(activeChatId),
        ])

        const mapped = history
          .map((entry) => mapMessageDto(entry, "delivered"))
          .sort((left, right) => left.timestamp - right.timestamp)

        setChannelName(resolvedChannelName)
        setMessages(mapped)
        await ensureProfiles(mapped.map((message) => message.senderId))
      } catch (historyError) {
        const message = historyError instanceof Error ? historyError.message : "Failed to load chat history"
        setError(message)
      } finally {
        setLoadingHistory(false)
      }
    },
    [ensureProfiles, loadChannelName],
  )

  useEffect(() => {
    if (!chatId || !authUser?.id) {
      setMessages([])
      setChannelName("")
      setIncomingCall(null)
      return
    }

    void loadChannelHistory(chatId)
  }, [authUser?.id, chatId, loadChannelHistory])

  useEffect(() => {
    return () => {
      if (chatId && isConnected && roomName === chatId) {
        void disconnect()
      }
    }
  }, [chatId, disconnect, isConnected, roomName])

  useEffect(() => {
    if (!chatId || !authUser?.id) {
      return
    }

    const realtime = getRealtimeClient()
    let disposed = false

    const onRealtimeEvent = (event: RealtimeEventMessage) => {
      if (disposed) {
        return
      }

      switch (event.event) {
        case "MESSAGE_CREATE": {
          if (!isChannelEvent(event, chatId) || !isRecord(event.data)) {
            return
          }

          const nextMessage: ChatMessage = {
            id: readString(event.data, "message_id", "messageId"),
            senderId: readString(event.data, "author_id", "authorId"),
            text: readString(event.data, "content"),
            timestamp: toUnixMs(event.data.created_at ?? event.data.createdAt),
            reactions: [],
            deliveryStatus: "delivered",
          }

          if (!nextMessage.id) {
            return
          }

          setMessages((previous) => {
            if (previous.some((message) => message.id === nextMessage.id)) {
              return previous
            }

            const optimisticIndex = previous.findIndex(
              (message) =>
                message.deliveryStatus === "sending" &&
                message.senderId === nextMessage.senderId &&
                message.text === nextMessage.text,
            )

            if (optimisticIndex >= 0) {
              const next = [...previous]
              next[optimisticIndex] = nextMessage
              return next
            }

            return [...previous, nextMessage]
          })

          void ensureProfiles([nextMessage.senderId])
          return
        }

        case "MESSAGE_UPDATE": {
          if (!isChannelEvent(event, chatId) || !isRecord(event.data)) {
            return
          }

          const messageId = readString(event.data, "message_id", "messageId")
          const content = readString(event.data, "content")
          if (!messageId) {
            return
          }

          setMessages((previous) =>
            previous.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    text: content || message.text,
                    isEdited: true,
                  }
                : message,
            ),
          )
          return
        }

        case "MESSAGE_DELETE": {
          if (!isChannelEvent(event, chatId) || !isRecord(event.data)) {
            return
          }

          const messageId = readString(event.data, "message_id", "messageId")
          if (!messageId) {
            return
          }

          setMessages((previous) =>
            previous.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    text: "[deleted]",
                  }
                : message,
            ),
          )
          return
        }

        case "MESSAGE_REACTION_ADD":
        case "MESSAGE_REACTION_REMOVE": {
          if (!isChannelEvent(event, chatId) || !isRecord(event.data)) {
            return
          }

          const messageId = readString(event.data, "message_id", "messageId")
          const emoji = readString(event.data, "emoji")
          const userId = readString(event.data, "user_id", "userId")
          if (!messageId || !emoji) {
            return
          }

          setMessages((previous) =>
            previous.map((message) => {
              if (message.id !== messageId) {
                return message
              }

              const reactions = [...message.reactions]
              const existingIndex = reactions.findIndex((reaction) => reaction.emoji === emoji)
              const delta = event.event === "MESSAGE_REACTION_ADD" ? 1 : -1

              if (existingIndex >= 0) {
                const nextCount = Math.max(0, reactions[existingIndex].count + delta)
                if (nextCount === 0) {
                  reactions.splice(existingIndex, 1)
                } else {
                  reactions[existingIndex] = {
                    ...reactions[existingIndex],
                    count: nextCount,
                  }
                }
              } else if (delta > 0) {
                reactions.push({
                  emoji,
                  userId,
                  count: 1,
                })
              }

              return {
                ...message,
                reactions,
              }
            }),
          )
          return
        }

        case "TYPING_START": {
          if (!isChannelEvent(event, chatId) || !isRecord(event.data)) {
            return
          }

          const userId = readString(event.data, "user_id", "userId")
          if (!userId || userId === authUser?.id) {
            return
          }

          setTypingByUserId((previous) => {
            const next = new Map(previous)
            next.set(userId, Date.now() + TYPING_INDICATOR_TTL_MS)
            return next
          })
          void ensureProfiles([userId])
          return
        }

        case "CALL_INVITE": {
          if (!isChannelEvent(event, chatId) || !isRecord(event.data)) {
            return
          }

          const callerId = readString(event.data, "caller_id", "callerId")
          if (!callerId || callerId === authUser?.id) {
            return
          }

          setIncomingCall({
            callerId,
            callerName: readString(event.data, "caller_name", "callerName") || callerId.slice(0, 8),
            startedAt: Date.now(),
          })
          return
        }

        case "CALL_ENDED": {
          if (isChannelEvent(event, chatId)) {
            setIncomingCall(null)
          }
          return
        }

        default:
          return
      }
    }

    const unsubscribe = realtime.subscribe(onRealtimeEvent)
    void realtime
      .connect()
      .then(async () => {
        await realtime.joinChannel(chatId)
      })
      .catch((connectError) => {
        console.warn("[ChatPage] realtime connection failed:", connectError)
      })

    return () => {
      disposed = true
      unsubscribe()
      void realtime.leaveChannel(chatId).catch(() => undefined)
    }
  }, [authUser?.id, chatId, ensureProfiles])

  useEffect(() => {
    const cleanup = window.setInterval(() => {
      const now = Date.now()
      setTypingByUserId((previous) => {
        const next = new Map(previous)
        for (const [userId, expiresAt] of next.entries()) {
          if (expiresAt <= now) {
            next.delete(userId)
          }
        }
        return next
      })
    }, 750)

    return () => {
      window.clearInterval(cleanup)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typingByUserId])

  useEffect(() => {
    if (!isCallInCurrentChat) {
      setCallDuration(0)
      return
    }

    const timer = window.setInterval(() => {
      setCallDuration((previous) => previous + 1)
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [isCallInCurrentChat])

  const typingUsers = useMemo(() => {
    const now = Date.now()
    const activeIds = Array.from(typingByUserId.entries())
      .filter(([, expiresAt]) => expiresAt > now)
      .map(([userId]) => userId)

    return activeIds.map((userId) => {
      const profile = profilesById[userId]
      return profile?.displayName || userId.slice(0, 8)
    })
  }, [profilesById, typingByUserId])

  const formatTimestamp = useCallback((timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [])

  const resolveSender = useCallback(
    (senderId: string): UserData => {
      if (senderId === resolvedCurrentUser.id) {
        return resolvedCurrentUser
      }

      const profile = profilesById[senderId]
      const displayName = profile?.displayName?.trim() || senderId.slice(0, 8)
      return {
        id: senderId,
        username: displayName,
        nickname: displayName,
        bio: profile?.bio || "",
        avatar: {
          src: profile?.avatar || null,
          alt: displayName,
        },
      }
    },
    [profilesById, resolvedCurrentUser],
  )

  const sendTypingSignal = useCallback(async () => {
    if (!chatId) {
      return
    }

    const now = Date.now()
    if (now - typingLastSentAtRef.current < 1200) {
      return
    }

    typingLastSentAtRef.current = now
    try {
      await getRealtimeClient().startTyping(chatId)
    } catch {
      // non-blocking typing signal
    }
  }, [chatId])

  const sendMessage = useCallback(async () => {
    if (!chatId || !inputValue.trim() || sendingMessage) {
      return
    }

    const content = inputValue.trim()
    const optimisticId = `local-${Date.now()}`
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      senderId: resolvedCurrentUser.id,
      text: content,
      timestamp: Date.now(),
      reactions: [],
      deliveryStatus: "sending",
    }

    setMessages((previous) => [...previous, optimisticMessage])
    setInputValue("")
    setSendingMessage(true)
    setError(null)

    try {
      const created = await api.messages.create({
        channelId: chatId,
        content,
      })
      const delivered = mapMessageDto(created, "delivered")
      setMessages((previous) =>
        previous.map((message) => (message.id === optimisticId ? delivered : message)),
      )
      await ensureProfiles([created.authorId])
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Failed to send message"
      setError(message)
      showErrorToast(t("message_placeholder"), message)
      setMessages((previous) =>
        previous.map((entry) =>
          entry.id === optimisticId
            ? {
                ...entry,
                deliveryStatus: "failed",
              }
            : entry,
        ),
      )
    } finally {
      setSendingMessage(false)
    }
  }, [chatId, ensureProfiles, inputValue, resolvedCurrentUser.id, sendingMessage, showErrorToast, t])

  const onInputChange = useCallback(
    (nextValue: string) => {
      setInputValue(nextValue)
      if (nextValue.trim()) {
        void sendTypingSignal()
      }
    },
    [sendTypingSignal],
  )

  const onInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        void sendMessage()
      }
    },
    [sendMessage],
  )

  const startCall = useCallback(
    async (mode: "voice" | "video") => {
      if (!chatId || !authUser?.id) {
        return
      }

      setError(null)
      try {
        if (isConnected && roomName !== chatId) {
          await disconnect()
        }

        await getRealtimeClient().dispatch("CALL_INVITE", {
          channel_id: chatId,
          caller_id: authUser.id,
          caller_name: resolvedCurrentUser.nickname,
          mode,
        })
        await connect(chatId, authUser.id, resolvedCurrentUser.nickname)
      } catch (callError) {
        const message = callError instanceof Error ? callError.message : "Failed to start call"
        setError(message)
        showErrorToast("Call", message)
      }
    },
    [
      authUser?.id,
      chatId,
      connect,
      disconnect,
      isConnected,
      resolvedCurrentUser.nickname,
      roomName,
      showErrorToast,
    ],
  )

  const acceptIncomingCall = useCallback(async () => {
    if (!chatId || !incomingCall || !authUser?.id) {
      return
    }

    try {
      await connect(chatId, authUser.id, resolvedCurrentUser.nickname)
      await getRealtimeClient().dispatch("CALL_ACCEPTED", {
        channel_id: chatId,
        caller_id: incomingCall.callerId,
        accepted_by: authUser.id,
      })
      setIncomingCall(null)
    } catch (callError) {
      const message = callError instanceof Error ? callError.message : "Failed to accept call"
      showErrorToast("Call", message)
    }
  }, [authUser?.id, chatId, connect, incomingCall, resolvedCurrentUser.nickname, showErrorToast])

  const declineIncomingCall = useCallback(async () => {
    if (!chatId || !incomingCall || !authUser?.id) {
      return
    }

    try {
      await getRealtimeClient().dispatch("CALL_DECLINED", {
        channel_id: chatId,
        caller_id: incomingCall.callerId,
        declined_by: authUser.id,
      })
    } finally {
      setIncomingCall(null)
    }
  }, [authUser?.id, chatId, incomingCall])

  const leaveCall = useCallback(async () => {
    if (!chatId) {
      return
    }

    await disconnect()
    await getRealtimeClient().dispatch("CALL_ENDED", {
      channel_id: chatId,
      ended_by: authUser?.id || resolvedCurrentUser.id,
    })
  }, [authUser?.id, chatId, disconnect, resolvedCurrentUser.id])

  if (!chatId) {
    return (
      <div className="chat-page">
        <div className="chat-page__empty">
          <MessageCircle size={64} />
          <h3>{t("no_chat_selected")}</h3>
          <p>{t("select_chat_description")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-page">
      <HeaderChat
        user={{
          avatar: null,
          name: channelName || `#${chatId.slice(0, 8)}`,
        }}
        onAudioCall={() => void startCall("voice")}
        onVideoCall={() => void startCall("video")}
      />

      {incomingCall && !isCallInCurrentChat && (
        <div className="chat-page__call-invite">
          <div className="chat-page__call-invite-text">
            <Phone size={16} />
            <span>{`${incomingCall.callerName} is calling...`}</span>
          </div>
          <div className="chat-page__call-invite-actions">
            <button className="chat-page__call-accept" onClick={() => void acceptIncomingCall()}>
              Accept
            </button>
            <button className="chat-page__call-decline" onClick={() => void declineIncomingCall()}>
              Decline
            </button>
          </div>
        </div>
      )}

      <InCallPanel
        isInCall={isCallInCurrentChat}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        callDuration={callDuration}
        roomName={channelName}
        participants={callParticipants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          avatar: profilesById[participant.id]?.avatar || undefined,
          isSpeaking: participant.isSpeaking,
          isMuted: participant.isMuted,
          isCameraOn: participant.isCameraOn,
          isScreenSharing: participant.isScreenSharing,
        }))}
        onMuteToggle={toggleMicrophone}
        onDeafenToggle={toggleDeafen}
        onCameraToggle={toggleCamera}
        onScreenShareToggle={toggleScreenShare}
        onLeaveCall={() => void leaveCall()}
      />

      <div className="chat-page__messages">
        {loadingHistory && <div className="chat-page__state">Loading messages...</div>}
        {error && <div className="chat-page__state chat-page__state--error">{error}</div>}

        {messages.map((message) => {
          const sender = resolveSender(message.senderId)
          return (
            <div key={message.id} className="message-item">
              <div className="message-item__avatar">
                <Avatar size={36} src={sender.avatar.src} alt={sender.nickname} />
              </div>
              <div className="message-item__content">
                <div className="message-item__header">
                  <span className="message-item__author">{sender.nickname || t("unknown_user")}</span>
                  <span className="message-item__timestamp">{formatTimestamp(message.timestamp)}</span>
                  {message.deliveryStatus && (
                    <span className="message-item__delivery">{message.deliveryStatus}</span>
                  )}
                </div>
                <div className="message-item__text">{message.text}</div>
                {message.reactions.length > 0 && (
                  <div className="message-item__reactions">
                    {message.reactions.map((reaction, index) => (
                      <button key={`${message.id}-${reaction.emoji}-${index}`} className="reaction-button">
                        {reaction.emoji} {reaction.count}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="message-item__actions">
                <button className="message-item__action">
                  <Smile size={16} />
                </button>
                <button className="message-item__action">
                  <Reply size={16} />
                </button>
                <button className="message-item__action">
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>
          )
        })}

        {typingUsers.length > 0 && (
          <div className="chat-page__typing">{`${typingUsers.join(", ")} ${typingUsers.length > 1 ? "are" : "is"} typing...`}</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-page__input-container">
        <div className="chat-page__input-wrapper">
          <button className="chat-page__action-button">
            <Plus size={20} />
          </button>
          <textarea
            ref={inputRef}
            className="chat-page__input"
            placeholder={t("message_placeholder")}
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            rows={1}
          />
          <div className="chat-page__actions">
            <button className="chat-page__action-button">
              <Gift size={20} />
            </button>
            <button className="chat-page__action-button">
              <Sticker size={20} />
            </button>
            <button className="chat-page__action-button">
              <Smile size={20} />
            </button>
            <button
              className="chat-page__action-button chat-page__action-button--send"
              onClick={() => void sendMessage()}
              disabled={!inputValue.trim() || sendingMessage}
              title={isCallInCurrentChat ? "Send message during call" : "Send message"}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatPage
