"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Bell, Phone, Video, User, UserPlus } from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { HeaderTextField } from "./header-text-field"
import Notifications from "./notifications"
import "./header.scss"
import { useTranslation } from "react-i18next"

interface FriendsHeaderProps {
  activeTab: "all" | "online" | "pending" | "blocked"
  onTabChange: (tab: "all" | "online" | "pending" | "blocked") => void
  onAddFriend?: () => void
}

export const HeaderFriends: React.FC<FriendsHeaderProps> = ({
  activeTab,
  onTabChange,
  onAddFriend,
}) => {
  const [showNotifications, setShowNotifications] = useState(false)
  const [tabIndicatorStyle, setTabIndicatorStyle] = useState({})

  const allFriendTabRef = useRef<HTMLButtonElement>(null)
  const onlineFriendTabRef = useRef<HTMLButtonElement>(null)
  const pendingTabRef = useRef<HTMLButtonElement>(null)
  const blockedTabRef = useRef<HTMLButtonElement>(null)

  const { t } = useTranslation(["header", "friends"])

  useEffect(() => {
    const updateTabIndicator = () => {
      let activeTabRef

      switch (activeTab) {
        case "all":
          activeTabRef = allFriendTabRef
          break
        case "online":
          activeTabRef = onlineFriendTabRef
          break
        case "pending":
          activeTabRef = pendingTabRef
          break
        case "blocked":
          activeTabRef = blockedTabRef
          break
        default:
          activeTabRef = allFriendTabRef
      }

      if (activeTabRef.current) {
        const tabsContainer = activeTabRef.current.parentElement

        if (tabsContainer) {
          const allTabs = [allFriendTabRef.current, onlineFriendTabRef.current, pendingTabRef.current, blockedTabRef.current]
          const activeTabIndex = allTabs.indexOf(activeTabRef.current)

          let leftPosition = 0
          const gap = 4

          for (let i = 0; i < activeTabIndex; i++) {
            if (allTabs[i]) {
              leftPosition += allTabs[i]!.offsetWidth + gap
            }
          }

          const activeTabWidth = activeTabRef.current.offsetWidth

          setTabIndicatorStyle({
            width: `${activeTabWidth}px`,
            transform: `translateX(${leftPosition}px)`,
          })
        }
      }
    }

    updateTabIndicator()
    window.addEventListener("resize", updateTabIndicator)
    return () => window.removeEventListener("resize", updateTabIndicator)
  }, [activeTab])

  return (
    <header className="header" style={{ padding: 23 }}>
      <div className="header__left">
        <div className="header__user-info">
          <span className="header__username">{t("friends")}</span>
        </div>
        <div className="header__tabs">
          <button
            ref={allFriendTabRef}
            className={`header__tab ${activeTab === "all" ? "header__tab--active" : ""}`}
            onClick={() => onTabChange("all")}
          >
            {t("friends:all_friends")}
          </button>
          <button
            ref={onlineFriendTabRef}
            className={`header__tab ${activeTab === "online" ? "header__tab--active" : ""}`}
            onClick={() => onTabChange("online")}
          >
            {t("friends:online")}
          </button>
          <button
            ref={pendingTabRef}
            className={`header__tab ${activeTab === "pending" ? "header__tab--active" : ""}`}
            onClick={() => onTabChange("pending")}
          >
            {t("friends:pending")}
          </button>
          <button
            ref={blockedTabRef}
            className={`header__tab ${activeTab === "blocked" ? "header__tab--active" : ""}`}
            onClick={() => onTabChange("blocked")}
          >
            {t("friends:blocked")}
          </button>
          <div className="header__tab-indicator" style={tabIndicatorStyle} />
        </div>
      </div>

      <div className="header__right">
        <button className="header__action-button" onClick={onAddFriend}>
          <UserPlus size={16} />
          <span>{t("friends:add_friend")}</span>
        </button>

        <button
          className="header__icon-button header__icon-button--notifications"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Bell />
        </button>

        {showNotifications && <Notifications onClose={() => setShowNotifications(false)} />}
      </div>
    </header>
  )
}

interface ChatHeaderProps {
  user: {
    avatar: string | null
    name: string
  }
  onAudioCall?: () => void
  onVideoCall?: () => void
  onOpenProfile?: () => void
  onSearch?: (query: string) => void
}

export const HeaderChat: React.FC<ChatHeaderProps> = ({ user, onAudioCall, onVideoCall, onOpenProfile, onSearch }) => {
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { t } = useTranslation("header")

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    onSearch?.(value)
  }

  return (
    <header className="header">
      <div className="header__left">
        <div className="header__user-info">
          <Avatar src={user.avatar} alt={user.name} size={34} />
          <span className="header__username">{user.name}</span>
        </div>
      </div>

      <div className="header__right">
        <button className="header__icon-button" onClick={onAudioCall}>
          <Phone />
        </button>

        <button className="header__icon-button" onClick={onVideoCall}>
          <Video />
        </button>

        <button className="header__icon-button" onClick={onOpenProfile}>
          <User />
        </button>

        <div className="header__search">
          <HeaderTextField value={searchQuery} onChange={handleSearchChange} placeholder={t("search_messages")} />
        </div>

        <button
          className="header__icon-button header__icon-button--notifications"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Bell />
        </button>

        {showNotifications && <Notifications onClose={() => setShowNotifications(false)} />}
      </div>
    </header>
  )
}
