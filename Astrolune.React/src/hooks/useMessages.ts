import { useCallback, useMemo, useState } from "react"
import { api, type MessageDto } from "../lib/api-client"

interface UseMessagesState {
  loading: boolean
  error: string | null
}

export function useMessages() {
  const [state, setState] = useState<UseMessagesState>({
    loading: false,
    error: null,
  })
  const [messages, setMessages] = useState<MessageDto[] | null>(null)

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setState({ loading: true, error: null })
    try {
      const result = await fn()
      setState({ loading: false, error: null })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed"
      setState({ loading: false, error: message })
      throw error
    }
  }, [])

  const getMessages = useCallback(
    async (channelId: string, limit = 100, before?: string) => {
      const result = await run(() => api.messages.listChannelMessages(channelId, limit, before))
      setMessages(result)
      return result
    },
    [run],
  )

  const sendMessage = useCallback(
    async (channelId: string, content: string, attachments?: string[]) =>
      run(() => api.messages.create({ channelId, content, attachments })),
    [run],
  )

  const updateMessage = useCallback(
    async (channelId: string, messageId: string, content: string) =>
      run(() => api.messages.update(channelId, messageId, { content })),
    [run],
  )

  const deleteMessage = useCallback(
    async (channelId: string, messageId: string) => run(() => api.messages.remove(channelId, messageId)),
    [run],
  )

  const addReaction = useCallback(
    async (channelId: string, messageId: string, emoji: string) =>
      run(() => api.messages.addReaction(channelId, messageId, emoji)),
    [run],
  )

  const removeReaction = useCallback(
    async (channelId: string, messageId: string, emoji: string) =>
      run(() => api.messages.removeReaction(channelId, messageId, emoji)),
    [run],
  )

  return useMemo(
    () => ({
      getConversations: async () => [] as { id: string; title: string }[],
      getMessages,
      getUnreadCount: async () => ({ count: 0 }),
      sendMessage,
      markAsRead: async (_messageIds: string[]) => ({ ok: true }),
      updateMessage,
      deleteMessage,
      addReaction,
      removeReaction,
      conversations: null as null,
      messages,
      unreadCount: 0,
      loading: state.loading,
      error: state.error,
    }),
    [
      addReaction,
      deleteMessage,
      getMessages,
      messages,
      removeReaction,
      sendMessage,
      state.error,
      state.loading,
      updateMessage,
    ],
  )
}

