import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { api, type Friend, type FriendLinkDto, type UserProfileDto } from "../lib/api-client"
import { getRealtimeClient, type RealtimeEventMessage } from "../lib/realtime-client"
import { useAuthSession } from "../contexts/auth-context"
import type { UserStatus } from "../types"

export interface FriendRequest {
  id: string
  senderId: string
  receiverId: string
  status: "pending" | "accepted" | "rejected"
  sender?: Friend
  receiver?: Friend
  createdAt: string
}

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PresenceState = {
  status: UserStatus
  activity?: Friend["activity"]
}

const FRIENDS_CACHE_PREFIX = "astrolune:friends-cache:v1"
const inMemoryFriendsCache = new Map<string, Friend[]>()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const isFriend = (value: unknown): value is Friend => {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.id === "string" && typeof value.username === "string"
}

const isFriendArray = (value: unknown): value is Friend[] =>
  Array.isArray(value) && value.every((entry) => isFriend(entry))

const getFriendsCacheKey = (userId: string) => `${FRIENDS_CACHE_PREFIX}:${userId}`

const readFriendsCache = (userId: string): Friend[] => {
  const cachedInMemory = inMemoryFriendsCache.get(userId)
  if (cachedInMemory) {
    return cachedInMemory
  }

  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = window.localStorage.getItem(getFriendsCacheKey(userId))
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isFriendArray(parsed)) {
      return []
    }

    inMemoryFriendsCache.set(userId, parsed)
    return parsed
  } catch {
    return []
  }
}

const writeFriendsCache = (userId: string, friends: Friend[]) => {
  inMemoryFriendsCache.set(userId, friends)

  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(getFriendsCacheKey(userId), JSON.stringify(friends))
  } catch {
    // ignore cache write failures (private mode/quota)
  }
}

const normalizeStatus = (value: unknown): UserStatus => {
  const normalized = String(value || "offline").toLowerCase()
  if (normalized === "online" || normalized === "dnd" || normalized === "invisible" || normalized === "inactive") {
    return normalized
  }
  return "offline"
}

const mapFriendFromProfile = (
  link: FriendLinkDto,
  profile: UserProfileDto | null,
  presence?: PresenceState,
): Friend => {
  const displayName = profile?.displayName?.trim() || ""
  const fallbackUsername = link.userId.slice(0, 8)
  return {
    id: link.userId,
    username: displayName || fallbackUsername,
    displayName: displayName || undefined,
    avatarUrl: profile?.avatar || null,
    status: presence?.status || "offline",
    activity: presence?.activity,
    since: link.since,
  }
}

const parsePresenceEvent = (event: RealtimeEventMessage): PresenceState & { userId: string } | null => {
  if (event.event !== "PRESENCE_UPDATE" || !isRecord(event.data)) {
    return null
  }

  const userIdValue = event.data.user_id ?? event.data.userId
  if (typeof userIdValue !== "string" || !userIdValue.trim()) {
    return null
  }

  const activityRaw = event.data.activity
  const activity = isRecord(activityRaw)
    ? {
        icon: typeof activityRaw.icon === "string" ? activityRaw.icon : "",
        gameName: typeof activityRaw.gameName === "string" ? activityRaw.gameName : "Unknown",
        startTime:
          typeof activityRaw.startTime === "number" ? activityRaw.startTime : Date.now(),
        details: typeof activityRaw.details === "string" ? activityRaw.details : undefined,
      }
    : undefined

  return {
    userId: userIdValue,
    status: normalizeStatus(event.data.status),
    activity,
  }
}

export function useFriends() {
  const { user } = useAuthSession()
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests] = useState<FriendRequest[]>([])
  const [sentRequests] = useState<FriendRequest[]>([])
  const [blockedUsers] = useState<Friend[]>([])
  const [loading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [presenceByUserId, setPresenceByUserId] = useState<Map<string, PresenceState>>(new Map())
  const presenceByUserIdRef = useRef<Map<string, PresenceState>>(new Map())

  useEffect(() => {
    presenceByUserIdRef.current = presenceByUserId
  }, [presenceByUserId])

  useEffect(() => {
    if (!user?.id) {
      setFriends([])
      return
    }

    setFriends(readFriendsCache(user.id))
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      return
    }

    writeFriendsCache(user.id, friends)
  }, [friends, user?.id])

  const refreshAll = useCallback(async () => {
    if (!user?.id) {
      setFriends([])
      return
    }

    setError(null)
    try {
      const links = await api.users.getFriendLinks()
      const profiles = await Promise.all(
        links.map(async (link) => {
          try {
            const profile = await api.users.getById(link.userId)
            return [link.userId, profile] as const
          } catch {
            return [link.userId, null] as const
          }
        }),
      )

      const profileMap = new Map<string, UserProfileDto | null>(profiles)
      setFriends(
        links.map((link) =>
          mapFriendFromProfile(
            link,
            profileMap.get(link.userId) || null,
            presenceByUserIdRef.current.get(link.userId),
          ),
        ),
      )
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load friends"
      setError(message)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      return
    }

    void refreshAll()
  }, [refreshAll, user?.id])

  useEffect(() => {
    if (!user?.id) {
      return
    }

    const realtime = getRealtimeClient()
    const unsubscribe = realtime.subscribe((event) => {
      const presence = parsePresenceEvent(event)
      if (!presence) {
        return
      }

      setPresenceByUserId((previous) => {
        const next = new Map(previous)
        next.set(presence.userId, {
          status: presence.status,
          activity: presence.activity,
        })
        return next
      })

      setFriends((previous) =>
        previous.map((friend) =>
          friend.id === presence.userId
            ? {
                ...friend,
                status: presence.status,
                activity: presence.activity ?? friend.activity,
              }
            : friend,
        ),
      )
    })

    void realtime.connect().catch((connectError) => {
      console.warn("[useFriends] realtime connection failed:", connectError)
    })

    return () => {
      unsubscribe()
    }
  }, [user?.id])

  const resolveFriendId = useCallback(async (identifier: string) => {
    const value = identifier.trim()
    if (!value) {
      throw new Error("User id is required")
    }

    if (!GUID_PATTERN.test(value)) {
      throw new Error("Only UUID is supported for adding friends in current backend")
    }

    return value
  }, [])

  const sendFriendRequest = useCallback(
    async (identifier: string) => {
      setError(null)
      const friendId = await resolveFriendId(identifier)
      await api.users.addFriend(friendId)
      await refreshAll()
      return friendId
    },
    [refreshAll, resolveFriendId],
  )

  const removeFriend = useCallback(async (friendId: string) => {
    setError(null)
    await api.users.removeFriend(friendId)
    setFriends((previous) => previous.filter((friend) => friend.id !== friendId))
  }, [])

  const unsupportedPendingAction = useCallback(async () => {
    throw new Error("Pending friend requests are not exposed by the current user-service API")
  }, [])

  const getFriends = useCallback(async () => {
    await refreshAll()
  }, [refreshAll])

  const getPendingRequests = useCallback(async () => {
    return pendingRequests
  }, [pendingRequests])

  const getBlockedUsers = useCallback(async () => {
    return blockedUsers
  }, [blockedUsers])

  const unblockUser = useCallback(async () => {
    throw new Error("Blocked users are not exposed by the current user-service API")
  }, [])

  return useMemo(
    () => ({
      getFriends,
      getPendingRequests,
      getBlockedUsers,
      sendFriendRequest,
      acceptFriendRequest: unsupportedPendingAction,
      rejectFriendRequest: unsupportedPendingAction,
      removeFriend,
      unblockUser,
      friends,
      pendingRequests,
      sentRequests,
      blockedUsers,
      loading,
      error,
      refreshAll,
    }),
    [
      blockedUsers,
      error,
      friends,
      getBlockedUsers,
      getFriends,
      getPendingRequests,
      loading,
      pendingRequests,
      refreshAll,
      removeFriend,
      sendFriendRequest,
      sentRequests,
      unblockUser,
      unsupportedPendingAction,
    ],
  )
}

export { type Friend, type UserStatus } from "../lib/api-client"
