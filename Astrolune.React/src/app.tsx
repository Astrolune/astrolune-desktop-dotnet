"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuthSession } from "./contexts/auth-context"
import { MainSidebar } from "./components/main-sidebar/main-sidebar"
import { SettingsModal } from "./components/settings-modal/settings-modal"
import { WindowControls } from "./components/window-controls/window-controls"
import { toSidebarUser, toUserData } from "./lib/auth/user-data"
import { api, type ChannelDto, type GuildDto } from "./lib/api-client"
import { getRealtimeClient } from "./lib/realtime-client"
import type { Chat } from "./types"

import "./scss/app.scss"
import "./components/main-sidebar/main-sidebar.scss"

const isGuildServiceEnabled = import.meta.env.VITE_ENABLE_GUILD_SERVICE !== "false"

function App() {
  const { user: authUser } = useAuthSession()
  const authUserId = authUser?.id
  const navigate = useNavigate()
  const location = useLocation()
  const contentRef = useRef<HTMLDivElement>(null)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const subscribedChannelsRef = useRef<Set<string>>(new Set())

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), [])
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), [])
  const handleOpenFriends = useCallback(() => navigate("/friends"), [navigate])
  const currentUser = useMemo(() => toUserData(authUser), [authUser])
  const sidebarUser = useMemo(() => toSidebarUser(currentUser), [currentUser])

  const toChat = useCallback((guild: GuildDto, channel: ChannelDto): Chat => {
    return {
      id: channel.id,
      name: `#${channel.name}`,
      avatar: guild.icon,
      status: guild.name,
    }
  }, [])

  const loadChats = useCallback(async () => {
    if (!authUserId) {
      setChats([])
      return
    }

    if (!isGuildServiceEnabled) {
      setChats([])
      return
    }

    let guilds = await api.guilds.list()
    if (guilds.length === 0) {
      const created = await api.guilds.create({
        name: `${currentUser.nickname || "My"} Workspace`,
      })
      guilds = [created]
    }

    const channelPairs = await Promise.all(
      guilds.map(async (guild) => {
        const channels = await api.guilds.listChannels(guild.id)
        return { guild, channels }
      }),
    )

    if (channelPairs.every((pair) => pair.channels.length === 0)) {
      const targetGuild = guilds[0]
      if (targetGuild) {
        await api.guilds.createChannel(targetGuild.id, {
          name: "general",
          type: 0,
        })
      }
    }

    const hydrated = await Promise.all(
      guilds.map(async (guild) => ({
        guild,
        channels: await api.guilds.listChannels(guild.id),
      })),
    )

    const nextChats = hydrated
      .flatMap(({ guild, channels }) => channels.map((channel) => toChat(guild, channel)))
      .sort((a, b) => a.name.localeCompare(b.name))

    setChats(nextChats)
  }, [authUserId, currentUser.nickname, toChat])

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      return false
    }

    document.addEventListener("contextmenu", handleContextMenu)
    return () => document.removeEventListener("contextmenu", handleContextMenu)
  }, [])

  useEffect(() => {
    if (!isGuildServiceEnabled) {
      setChats([])
      return
    }

    void loadChats().catch((error) => {
      console.warn("[App] failed to load chats:", error)
      setChats([])
    })
  }, [loadChats])

  useEffect(() => {
    if (!authUserId) {
      return
    }

    const realtime = getRealtimeClient()
    const unsubscribe = realtime.subscribe((event) => {
      if (event.event !== "MESSAGE_CREATE") {
        return
      }

      if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) {
        return
      }

      const payload = event.data as Record<string, unknown>
      const channelId = typeof payload.channel_id === "string" ? payload.channel_id : ""
      const content = typeof payload.content === "string" ? payload.content : ""
      if (!channelId) {
        return
      }

      setChats((previous) => {
        const index = previous.findIndex((chat) => chat.id === channelId)
        if (index < 0) {
          return previous
        }

        const updated: Chat = {
          ...previous[index],
          status: content.slice(0, 48) || previous[index].status,
          lastMessage: content,
        }

        const next = [...previous]
        next.splice(index, 1)
        next.unshift(updated)
        return next
      })
    })

    void realtime.connect().catch((error) => {
      console.warn("[App] realtime connection failed:", error)
    })

    return () => {
      unsubscribe()
    }
  }, [authUserId])

  useEffect(() => {
    if (!authUserId) {
      return
    }

    const realtime = getRealtimeClient()
    const nextChannels = new Set(chats.map((chat) => chat.id))

    void realtime
      .connect()
      .then(async () => {
        for (const channelId of nextChannels) {
          if (!subscribedChannelsRef.current.has(channelId)) {
            await realtime.joinChannel(channelId)
          }
        }

        for (const channelId of subscribedChannelsRef.current) {
          if (!nextChannels.has(channelId)) {
            await realtime.leaveChannel(channelId)
          }
        }

        subscribedChannelsRef.current = nextChannels
      })
      .catch((error) => {
        console.warn("[App] failed to sync realtime channel subscriptions:", error)
      })
  }, [authUserId, chats])

  useEffect(() => {
    if (chats.length === 0) {
      return
    }

    const path = location.pathname
    if (path === "/" || path === "/chat" || path === "/chat/") {
      navigate(`/chat/${chats[0].id}`, { replace: true })
    }
  }, [chats, location.pathname, navigate])

  return (
    <>
      <div data-tauri-drag-region className="title-bar">
        <h4>
          Astro<span className="title-bar__infinity-text">Lune</span>
        </h4>
        <WindowControls />
      </div>

      <main>
        <MainSidebar
          chats={chats}
          user={sidebarUser}
          profileUser={currentUser}
          onOpenSettings={handleOpenSettings}
          onOpenFriends={handleOpenFriends}
        />

        <div className="container">
          <section ref={contentRef} className="container__content">
            <Outlet />
          </section>
        </div>
      </main>

      <SettingsModal visible={isSettingsOpen} onClose={handleCloseSettings} user={currentUser} />
    </>
  )
}

export default App
