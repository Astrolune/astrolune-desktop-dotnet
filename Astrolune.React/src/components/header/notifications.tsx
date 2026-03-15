"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, X, CheckCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getRealtimeClient, type RealtimeEventMessage } from "../../lib/realtime-client"
import "./notifications.scss"

interface NotificationItem {
  id: string
  type: "warning" | "danger" | "success"
  title: string
  message: string
  time: number
  isRead: boolean
  isReadAnimating?: boolean
  isHidden?: boolean
}

interface NotificationsProps {
  onClose: () => void
}

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

const mapRealtimeToNotification = (event: RealtimeEventMessage): NotificationItem | null => {
  const id = `${event.event}-${event.timestamp}`
  const data = isRecord(event.data) ? event.data : {}

  switch (event.event) {
    case "MESSAGE_CREATE": {
      const author = readString(data, "author_id", "authorId")
      return {
        id,
        type: "success",
        title: "New message",
        message: readString(data, "content") || `Message from ${author.slice(0, 8) || "user"}`,
        time: event.timestamp,
        isRead: false,
      }
    }
    case "CALL_INVITE": {
      const caller = readString(data, "caller_name", "callerName", "caller_id", "callerId")
      return {
        id,
        type: "warning",
        title: "Incoming call",
        message: caller ? `${caller} is calling` : "Incoming call in active channel",
        time: event.timestamp,
        isRead: false,
      }
    }
    case "PRESENCE_UPDATE": {
      const userId = readString(data, "user_id", "userId")
      const status = readString(data, "status") || "online"
      return {
        id,
        type: "warning",
        title: "Friend status",
        message: `${userId.slice(0, 8)} is now ${status}`,
        time: event.timestamp,
        isRead: false,
      }
    }
    case "USER_NOTIFICATION": {
      return {
        id,
        type: "success",
        title: readString(data, "title") || "Notification",
        message: readString(data, "message"),
        time: event.timestamp,
        isRead: false,
      }
    }
    default:
      return null
  }
}

const formatTimeAgo = (timestamp: number, now: number) => {
  const diffMs = Math.max(0, now - timestamp)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} d ago`
}

const Notifications: React.FC<NotificationsProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<"new" | "archive" | "news">("new")
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [archive, setArchive] = useState<NotificationItem[]>([])
  const [now, setNow] = useState(() => Date.now())
  const notificationsRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation("notifications")

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [onClose])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const realtime = getRealtimeClient()
    const unsubscribe = realtime.subscribe((event) => {
      const next = mapRealtimeToNotification(event)
      if (!next) {
        return
      }

      setNotifications((previous) => [next, ...previous].slice(0, 200))
    })

    void realtime.connect().catch((error) => {
      console.warn("[notifications] realtime connection failed:", error)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const tabIndicatorStyle = useMemo(() => {
    const tabIndex = activeTab === "new" ? 0 : activeTab === "archive" ? 1 : 2
    return { width: "33.333%", transform: `translateX(${tabIndex * 100}%)` }
  }, [activeTab])

  const current = useMemo(() => {
    switch (activeTab) {
      case "archive":
        return archive
      case "news":
        return []
      case "new":
      default:
        return notifications
    }
  }, [activeTab, archive, notifications])

  const markAsRead = (id: string) => {
    setNotifications((previous) =>
      previous.map((item) => (item.id === id ? { ...item, isReadAnimating: true } : item)),
    )
    window.setTimeout(() => {
      setNotifications((previous) =>
        previous.map((item) => (item.id === id ? { ...item, isRead: true, isReadAnimating: false } : item)),
      )
    }, 250)
  }

  const moveToArchive = (id: string) => {
    setNotifications((previous) => {
      const found = previous.find((item) => item.id === id)
      if (found) {
        setArchive((archivePrev) => [{ ...found, isRead: true }, ...archivePrev].slice(0, 200))
      }
      return previous.map((item) => (item.id === id ? { ...item, isHidden: true } : item))
    })

    window.setTimeout(() => {
      setNotifications((previous) => previous.filter((item) => item.id !== id))
    }, 250)
  }

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "warning":
        return <AlertTriangle />
      case "danger":
        return <X />
      case "success":
      default:
        return <CheckCircle color="green" />
    }
  }

  return (
    <div className="notifications" ref={notificationsRef}>
      <div className="notifications__header">
        <div className="notifications__tabs">
          <button
            className={`notifications__tab ${activeTab === "new" ? "notifications__tab--active" : ""}`}
            onClick={() => setActiveTab("new")}
          >
            {t("new")}
          </button>
          <button
            className={`notifications__tab ${activeTab === "archive" ? "notifications__tab--active" : ""}`}
            onClick={() => setActiveTab("archive")}
          >
            {t("archive")}
          </button>
          <button
            className={`notifications__tab ${activeTab === "news" ? "notifications__tab--active" : ""}`}
            onClick={() => setActiveTab("news")}
          >
            {t("news")}
          </button>
          <div className="notifications__tab-indicator" style={tabIndicatorStyle} />
        </div>
      </div>

      <div className="notifications__content">
        {current.length === 0 ? (
          <div className="notifications__empty">{t("no_notifications")}</div>
        ) : (
          current.map((item) => (
            <div
              key={item.id}
              className={[
                "notifications__item",
                !item.isRead ? "notifications__item--unread" : "",
                item.isReadAnimating ? "read" : "",
                item.isHidden ? "hidden" : "",
              ].join(" ")}
            >
              <div className={`notifications__icon notifications__icon--${item.type}`}>{getIcon(item.type)}</div>

              <div className="notifications__text">
                <div className="notifications__title">{item.title}</div>
                <div className="notifications__message">{item.message}</div>
                <div className="notifications__time">{formatTimeAgo(item.time, now)}</div>

                {activeTab === "new" && !item.isRead && (
                  <div className="notifications__actions-item">
                    <button className="notifications__action-btn" onClick={() => markAsRead(item.id)}>
                      {t("read")}
                    </button>
                    <button
                      className="notifications__action-btn notifications__action-btn--archive"
                      onClick={() => moveToArchive(item.id)}
                    >
                      {t("to_the_archive")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Notifications

