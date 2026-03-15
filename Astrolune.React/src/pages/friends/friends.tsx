"use client"

import type React from "react"
import { useCallback, useMemo, useState } from "react"
import { Check, MessageCircle, MoreHorizontal, UserPlus, UserRoundMinus, X } from "lucide-react"
import { Avatar } from "../../components/avatar/avatar"
import { HeaderFriends } from "../../components/header/header"
import { Modal } from "../../components/modal/modal"
import { Button } from "../../components/button/button"
import { TextField } from "../../components/text-field/text-field"
import { useFriends } from "../../hooks/useFriends"
import { useToast } from "../../hooks/useToast"
import { useTranslation } from "react-i18next"
import { useAuthSession } from "../../contexts/auth-context"
import type { Friend, FriendRequest, UserStatus } from "../../types"
import cn from "classnames"
import "./friends.scss"

type FriendsTab = "all" | "online" | "pending" | "blocked"

interface FriendsPageProps {
  initialTab?: FriendsTab
}

const getStatusText = (
  t: (key: string) => string,
  status?: UserStatus,
  activity?: Friend["activity"],
) => {
  if (activity) {
    return `${t("playing")} ${activity.gameName}`
  }

  switch (status) {
    case "online":
      return t("status_online")
    case "dnd":
      return t("status_dnd")
    case "inactive":
      return t("status_inactive")
    default:
      return t("status_offline")
  }
}

export const FriendsPage: React.FC<FriendsPageProps> = ({ initialTab = "all" }) => {
  const [activeTab, setActiveTab] = useState<FriendsTab>(initialTab)
  const [searchQuery, setSearchQuery] = useState("")
  const [friendIdentifier, setFriendIdentifier] = useState("")
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { t } = useTranslation("friends")
  const { user } = useAuthSession()
  const { showSuccessToast, showErrorToast } = useToast()

  const {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    unblockUser,
    friends,
    pendingRequests,
    blockedUsers,
  } = useFriends()

  const pendingAsFriends = useMemo(() => {
    return pendingRequests.map((request): Friend => {
      const incoming = request.receiverId === user?.id
      const peer = incoming ? request.sender : request.receiver
      const fallbackId = incoming ? request.senderId : request.receiverId

      return {
        id: peer?.id || fallbackId,
        username: peer?.username || fallbackId,
        displayName: peer?.displayName,
        avatarUrl: peer?.avatarUrl,
        status: peer?.status,
        activity: peer?.activity,
      }
    })
  }, [pendingRequests, user?.id])

  const baseList = useMemo(() => {
    switch (activeTab) {
      case "online":
        return friends.filter((friend) =>
          ["online", "dnd", "inactive"].includes(friend.status || "offline"),
        )
      case "pending":
        return pendingAsFriends
      case "blocked":
        return blockedUsers
      case "all":
      default:
        return friends
    }
  }, [activeTab, blockedUsers, friends, pendingAsFriends])

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) {
      return baseList
    }

    const query = searchQuery.toLowerCase()
    return baseList.filter((friend) => {
      const fullName = friend.displayName?.toLowerCase() || ""
      const username = friend.username.toLowerCase()
      return fullName.includes(query) || username.includes(query)
    })
  }, [baseList, searchQuery])

  const handleSendFriendRequest = useCallback(async () => {
    const normalized = friendIdentifier.trim()
    if (!normalized || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    try {
      await sendFriendRequest(normalized)
      showSuccessToast(t("send_request"), t("add_friend_description"))
      setFriendIdentifier("")
      setIsAddFriendModalOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send request"
      showErrorToast(t("send_request"), message)
    } finally {
      setIsSubmitting(false)
    }
  }, [friendIdentifier, isSubmitting, sendFriendRequest, showErrorToast, showSuccessToast, t])

  const handleRemoveFriend = useCallback(
    async (friendId: string) => {
      try {
        await removeFriend(friendId)
        showSuccessToast(t("all_friends"), "Friend removed")
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to remove friend"
        showErrorToast(t("all_friends"), message)
      }
    },
    [removeFriend, showErrorToast, showSuccessToast, t],
  )

  const handleUnblock = useCallback(
    async (friendId: string) => {
      try {
        await unblockUser(friendId)
        showSuccessToast(t("blocked"), "User unblocked")
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to unblock user"
        showErrorToast(t("blocked"), message)
      }
    },
    [showErrorToast, showSuccessToast, t, unblockUser],
  )

  const findPendingRequest = useCallback(
    (friendId: string): FriendRequest | null => {
      return pendingRequests.find(
        (request) =>
          request.senderId === friendId ||
          request.receiverId === friendId ||
          request.sender?.id === friendId ||
          request.receiver?.id === friendId,
      ) || null
    },
    [pendingRequests],
  )

  const handleAcceptRequest = useCallback(
    async (friendId: string) => {
      const request = findPendingRequest(friendId)
      if (!request) {
        return
      }

      try {
        await acceptFriendRequest(request.id)
        showSuccessToast(t("pending"), "Request accepted")
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to accept request"
        showErrorToast(t("pending"), message)
      }
    },
    [acceptFriendRequest, findPendingRequest, showErrorToast, showSuccessToast, t],
  )

  const handleRejectRequest = useCallback(
    async (friendId: string) => {
      const request = findPendingRequest(friendId)
      if (!request) {
        return
      }

      try {
        await rejectFriendRequest(request.id)
        showSuccessToast(t("pending"), "Request rejected")
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to reject request"
        showErrorToast(t("pending"), message)
      }
    },
    [findPendingRequest, rejectFriendRequest, showErrorToast, showSuccessToast, t],
  )

  const renderFriendActions = useCallback(
    (friend: Friend) => {
      if (activeTab === "pending") {
        return (
          <div className="friend-item__actions friend-item__actions--visible">
            <button className="friend-item__action friend-item__action--accept" onClick={() => void handleAcceptRequest(friend.id)}>
              <Check size={16} />
            </button>
            <button className="friend-item__action friend-item__action--danger" onClick={() => void handleRejectRequest(friend.id)}>
              <X size={16} />
            </button>
          </div>
        )
      }

      if (activeTab === "blocked") {
        return (
          <div className="friend-item__actions friend-item__actions--visible">
            <button className="friend-item__action" onClick={() => void handleUnblock(friend.id)}>
              <UserPlus size={16} />
            </button>
          </div>
        )
      }

      return (
        <div className="friend-item__actions">
          <button className="friend-item__action">
            <MessageCircle size={18} />
          </button>
          <button className="friend-item__action" onClick={() => void handleRemoveFriend(friend.id)}>
            <UserRoundMinus size={16} />
          </button>
          <button className="friend-item__action">
            <MoreHorizontal size={18} />
          </button>
        </div>
      )
    },
    [activeTab, handleAcceptRequest, handleRejectRequest, handleRemoveFriend, handleUnblock],
  )

  const renderFriendItem = useCallback(
    (friend: Friend) => (
      <div key={friend.id} className="friend-item">
        <div className="friend-item__avatar">
          <Avatar size={40} src={friend.avatarUrl} alt={friend.displayName || friend.username} />
          <div
            className={cn(
              "friend-item__status-indicator",
              `friend-item__status-indicator--${friend.status || "offline"}`,
            )}
          />
        </div>
        <div className="friend-item__info">
          <div className="friend-item__name">{friend.displayName || friend.username}</div>
          <div className="friend-item__status">{getStatusText(t, friend.status, friend.activity)}</div>
        </div>
        {renderFriendActions(friend)}
      </div>
    ),
    [renderFriendActions, t],
  )

  const renderContent = () => {
    if (filteredFriends.length === 0) {
      return (
        <div className="friends-page__empty">
          <UserPlus size={48} />
          <h3>{t("no_friends_title")}</h3>
          <p>{t("no_friends_description")}</p>
          <Button theme="outline" onClick={() => setIsAddFriendModalOpen(true)}>
            {t("add_friend")}
          </Button>
        </div>
      )
    }

    return (
      <div className="friends-page__section">
        <div className="friends-page__section-title">
          {activeTab === "online" ? t("online") : activeTab === "pending" ? t("pending") : activeTab === "blocked" ? t("blocked") : t("all_friends")} |{" "}
          {filteredFriends.length}
        </div>
        <div className="friends-page__list">{filteredFriends.map(renderFriendItem)}</div>
      </div>
    )
  }

  return (
    <div className="friends-page">
      <HeaderFriends activeTab={activeTab} onTabChange={setActiveTab} onAddFriend={() => setIsAddFriendModalOpen(true)} />
      <div className="friends-page__content">
        <div className="friends-page__search">
          <TextField
            type="text"
            placeholder={t("search_friends")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        {renderContent()}
      </div>

      <Modal
        visible={isAddFriendModalOpen}
        onClose={() => setIsAddFriendModalOpen(false)}
        title={t("add_friend")}
        description={t("add_friend_description")}
      >
        <div className="friends-page__add-form">
          <div className="friends-page__add-input-wrapper">
            <TextField
              type="text"
              placeholder={t("add_friend_placeholder")}
              value={friendIdentifier}
              onChange={(event) => setFriendIdentifier(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSendFriendRequest()
                }
              }}
            />
            <Button
              className="friends-page__add-button"
              onClick={() => void handleSendFriendRequest()}
              disabled={!friendIdentifier.trim() || isSubmitting}
            >
              {isSubmitting ? "..." : t("send_request")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default FriendsPage
