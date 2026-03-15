import { useCallback } from "react"

export interface User {
  id: string
  name: string
  username?: string
  avatar?: string
  status: "friend" | "online" | "offline" | "blocked"
  lastSeen?: Date
}

export interface Message {
  id: string
  content: string
  author: User
  timestamp: Date
  channel?: string
}

export interface UseCommandMenuReturn {
  useUsers: (query: string) => {
    users: User[]
    loading: boolean
    error?: string
  }
  useMessages: (query: string) => {
    messages: Message[]
    loading: boolean
    error?: string
  }
}

export function useCommandMenu(): UseCommandMenuReturn {
  const useUsers = useCallback((query: string) => {
    void query
    return {
      users: [],
      loading: false,
      error: undefined,
    }
  }, [])

  const useMessages = useCallback((query: string) => {
    void query
    return {
      messages: [],
      loading: false,
      error: undefined,
    }
  }, [])

  return {
    useUsers,
    useMessages,
  }
}

