import type { UserData, ChatMessage, Chat } from "./types"

export const VERSION_CODENAME = "Beta"

export const MAX_MINUTES_TO_SHOW_IN_PLAYTIME = 120

export const CURRENT_USER: UserData = {
  id: "user-1",
  nickname: "I'm",
  username: "I",
  pronouns: "I",
  avatar: {
    src: null,
    alt: "I",
  },
  bio: "This is your profile. You can edit your bio in settings.",
  status: "online",
  banner: null,
}

export const USERS: UserData[] = [
  {
    id: "user-2",
    nickname: "Alex",
    username: "alexj",
    avatar: {
      src: null,
      alt: "Alex Johnson",
    },
    bio: "Game developer and UI/UX enthusiast. Working on cool projects!",
    status: "online",
    banner: null,
    activity: {
      gameName: "Cyberpunk 2077",
      icon: "",
      startTime: Date.now() - 3600000 * 2,
    },
  },
  {
    id: "user-3",
    nickname: "Sarah",
    username: "sarahm",
    avatar: {
      src: null,
      alt: "Sarah Miller",
    },
    bio: "Digital artist and streamer. Follow me on Twitch!",
    status: "dnd",
    banner: null,
  },
  {
    id: "user-4",
    nickname: "Mike",
    username: "mikec",
    avatar: {
      src: null,
      alt: "Mike Chen",
    },
    bio: "Software engineer. React & TypeScript enthusiast.",
    status: "inactive",
    banner: null,
    activity: {
      gameName: "League of Legends",
      icon: "",
      startTime: Date.now() - 1800000,
    },
  },
]

export const SAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    senderId: "user-2",
    text: "Hey! How are you doing?",
    timestamp: Date.now() - 3600000 * 2,
    reactions: [],
  },
  {
    id: "msg-2",
    senderId: "user-3",
    text: "Working on a new project!",
    timestamp: Date.now() - 3600000,
    reactions: [
      { userId: "user-1", emoji: "👍", count: 2 },
      { userId: "user-2", emoji: "❤️", count: 1 },
    ],
  },
  {
    id: "msg-3",
    senderId: "user-2",
    text: "That sounds awesome! What kind of project?",
    timestamp: Date.now() - 1800000,
    reactions: [],
  },
  {
    id: "msg-4",
    senderId: "user-1",
    text: "A new messenger app actually!",
    timestamp: Date.now() - 1200000,
    reactions: [{ userId: "user-4", emoji: "🎉", count: 3 }],
  },
]

export const servers = [
  {
    id: "1",
    name: "NΞTcordix",
    description: "This is the first server.",
    avatarUrl: "",
    bannerUrl: "",
    joinDate: "01.02.25",
  },
]

export const chats: Chat[] = [
  { id: "1", name: "Roblox gay", avatar: null, status: "Играет в Roblox" },
  { id: "2", name: "Ankerin", avatar: null, status: "Online" },
]

export const user = {
  name: CURRENT_USER.nickname,
  avatar: CURRENT_USER.avatar.src,
  status: "Online",
}
