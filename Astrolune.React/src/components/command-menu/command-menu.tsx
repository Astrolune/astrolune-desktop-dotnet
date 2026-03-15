import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Avatar } from "../avatar/avatar"
import "./command-menu.scss"

export interface User {
  id: string
  name: string
  username?: string
  avatar?: string
  lastSeen?: Date
}

export interface Message {
  id: string
  content: string
  author: User
  timestamp: Date
  channel?: string
}

export interface CommandMenuProps {
  isOpen: boolean
  onClose: () => void
  onUserSelect?: (user: User) => void
  onMessageSelect?: (message: Message) => void
  useUsers?: (query: string) => {
    users: User[]
    loading: boolean
    error?: string
  }
  useMessages?: (query: string) => {
    messages: Message[]
    loading: boolean
    error?: string
  }
  users?: User[]
  messages?: Message[]
  placeholder?: string
  showUsers?: boolean
  showMessages?: boolean
}

const defaultUsers: User[] = []
const defaultMessages: Message[] = []

export function CommandMenu({
  isOpen,
  onClose,
  onUserSelect,
  onMessageSelect,
  useUsers,
  useMessages,
  users = defaultUsers,
  messages = defaultMessages,
  showUsers = true,
  showMessages = true,
}: CommandMenuProps) {
  const { t } = useTranslation("command_menu")
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  const usersData = useUsers?.(query) || { users, loading: false }
  const messagesData = useMessages?.(query) || { messages, loading: false }

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return usersData.users
    const normalized = query.toLowerCase()
    return usersData.users.filter(
      (user) =>
        user.name.toLowerCase().includes(normalized) ||
        user.username?.toLowerCase().includes(normalized),
    )
  }, [query, usersData.users])

  const filteredMessages = useMemo(() => {
    if (!query.trim()) return messagesData.messages
    const normalized = query.toLowerCase()
    return messagesData.messages.filter(
      (message) =>
        message.content.toLowerCase().includes(normalized) ||
        message.author.name.toLowerCase().includes(normalized),
    )
  }, [messagesData.messages, query])

  const totalItems = (showUsers ? filteredUsers.length : 0) + (showMessages ? filteredMessages.length : 0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) {
        return
      }

      switch (event.key) {
        case "Escape":
          onClose()
          return
        case "ArrowDown":
          event.preventDefault()
          if (totalItems > 0) {
            setSelectedIndex((previous) => (previous + 1) % totalItems)
          }
          return
        case "ArrowUp":
          event.preventDefault()
          if (totalItems > 0) {
            setSelectedIndex((previous) => (previous - 1 + totalItems) % totalItems)
          }
          return
        default:
          return
      }
    },
    [isOpen, onClose, totalItems],
  )

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [onKeyDown])

  const formatTimestamp = useCallback(
    (timestamp: Date) => {
      const now = Date.now()
      const diff = now - timestamp.getTime()
      const minutes = Math.floor(diff / 60_000)
      const hours = Math.floor(diff / 3_600_000)
      const days = Math.floor(diff / 86_400_000)

      if (minutes < 1) return t("just_now")
      if (minutes < 60) return t("minutes_ago", { ago: minutes })
      if (hours < 24) return t("hours_ago", { ago: hours })
      if (days < 7) return t("days_ago", { ago: days })
      return timestamp.toLocaleDateString()
    },
    [t],
  )

  if (!isOpen) {
    return null
  }

  const hasResults = filteredUsers.length > 0 || filteredMessages.length > 0
  const loading = usersData.loading || messagesData.loading

  return (
    <>
      <div className="commands-menu__backdrop" onClick={onClose} />
      <div className="commands-menu">
        <div className="commands-menu__header">
          <div className="commands-menu__search-container">
            <input
              type="text"
              className="commands-menu__search"
              placeholder={t("search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div
          className="commands-menu__content-wrapper"
          style={{
            height: hasResults ? "auto" : "200px",
            minHeight: hasResults ? "100px" : "200px",
            maxHeight: "400px",
          }}
        >
          <div className="commands-menu__content">
            {loading ? (
              <div className="commands-menu__loading">{t("loading")}</div>
            ) : !hasResults ? (
              <div className="commands-menu__empty">
                {query.trim() ? t("no_results") : t("start_typing")}
              </div>
            ) : (
              <>
                {showUsers && filteredUsers.length > 0 && (
                  <div className="commands-menu__section">
                    <div className="commands-menu__section-title">{t("users")}</div>
                    {filteredUsers.map((user, index) => (
                      <button
                        key={user.id}
                        className="commands-menu__item"
                        data-selected={selectedIndex === index}
                        onClick={() => onUserSelect?.(user)}
                      >
                        <div className="commands-menu__item-avatar">
                          <Avatar size={32} src={user.avatar} alt={user.name} />
                        </div>
                        <div className="commands-menu__item-content">
                          <div className="commands-menu__item-title">{user.name}</div>
                          {user.username && <div className="commands-menu__item-subtitle">@{user.username}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showMessages && filteredMessages.length > 0 && (
                  <div className="commands-menu__section">
                    <div className="commands-menu__section-title">{t("messages")}</div>
                    {filteredMessages.map((message, index) => (
                      <button
                        key={message.id}
                        className="commands-menu__item"
                        data-selected={selectedIndex === (showUsers ? filteredUsers.length : 0) + index}
                        onClick={() => onMessageSelect?.(message)}
                      >
                        <div className="commands-menu__item-avatar">
                          <Avatar size={32} src={message.author.avatar} alt={message.author.name} />
                        </div>
                        <div className="commands-menu__item-content">
                          <div className="commands-menu__item-title">{message.content}</div>
                          <div className="commands-menu__item-subtitle">
                            {message.author.name} | {formatTimestamp(message.timestamp)}
                            {message.channel ? ` | #${message.channel}` : ""}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
