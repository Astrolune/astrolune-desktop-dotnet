import type React from "react"

export type AppUpdaterEvent =
  | { type: "update-available"; info: { version: string } }
  | { type: "update-downloaded" }
  | { type: "error"; error: { message: string } }

export type UserStatus = "online" | "dnd" | "invisible" | "inactive" | "offline"

export interface Server {
  id: string
  name: string
  joinDate: string
  description: string | null
  avatarUrl?: string | null
  bannerUrl?: string | null
}

export interface Chat {
  id: string
  name: string
  avatar: string | null
  status: string
  lastMessage?: string
  unreadCount?: number
}

export interface User {
  id?: string
  name: string
  avatar: string | null
  status: string
}

export type MediaContent = {}

export interface Message {
  id: string
  senderId: string
  content: string
  timestamp: number
  isEdited?: boolean
  attachments?: MediaContent[]
}

export interface UserData {
  id: string
  avatar: {
    src: string | null
    alt?: string
  }
  banner?: string | null
  username: string
  nickname: string
  bio: string
  pronouns?: string
  status?: UserStatus
  activity?: UserActivity
}

export interface UserActivity {
  icon: string
  gameName: string
  startTime: number
  details?: string
}

export interface Profile {
  id: string
  userId: string
  username: string
  displayName?: string
  pronouns?: string
  bio?: string
  avatarUrl?: string | null
  bannerUrl?: string | null
  status?: UserStatus
  lastSeen?: string
  createdAt: string
  updatedAt: string
}

export interface Friend {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string | null
  status?: UserStatus
  activity?: UserActivity
}

export interface FriendRequest {
  id: string
  senderId: string
  receiverId: string
  status: "pending" | "accepted" | "rejected"
  sender?: Friend
  receiver?: Friend
  createdAt: string
}

export interface SettingsSection {
  id: string
  label: string
  icon?: React.ReactNode
}

export interface SettingsCategory {
  title: string
  items: SettingsSection[]
}

export * from "./chat"

export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
  display_id: string
  appIcon: string | null
}
