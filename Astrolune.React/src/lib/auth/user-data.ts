import { CURRENT_USER } from "../../constants"
import type { User, UserData } from "../../types"
import type { AuthUser } from "./session"

const safeTrim = (value: string | null | undefined) => value?.trim() ?? ""
const isEmailLike = (value: string) => value.includes("@")

const resolveUsername = (authUser: AuthUser, fallbackName: string) => {
  const username = safeTrim(authUser.username)
  if (username && !isEmailLike(username)) {
    return username
  }

  const displayName = safeTrim(authUser.displayName)
  if (displayName) {
    return displayName
  }

  const email = safeTrim(authUser.email)
  if (email) {
    const localPart = email.split("@")[0]?.trim() ?? ""
    if (localPart) {
      return localPart
    }
  }

  return fallbackName || CURRENT_USER.username
}

const resolveNickname = (authUser: AuthUser) => {
  const displayName = safeTrim(authUser.displayName)
  if (displayName) {
    return displayName
  }

  const username = safeTrim(authUser.username)
  if (username && !isEmailLike(username)) {
    return username
  }

  const email = safeTrim(authUser.email)
  if (email) {
    const localPart = email.split("@")[0]?.trim() ?? ""
    if (localPart) {
      return localPart
    }
  }

  return CURRENT_USER.nickname
}

export const toUserData = (authUser: AuthUser | null): UserData => {
  if (!authUser) {
    return CURRENT_USER
  }

  const nickname = resolveNickname(authUser)
  const username = resolveUsername(authUser, nickname)

  return {
    ...CURRENT_USER,
    id: safeTrim(authUser.id) || CURRENT_USER.id,
    username,
    nickname,
    avatar: {
      ...CURRENT_USER.avatar,
      alt: nickname,
    },
  }
}

export const toSidebarUser = (userData: UserData): User => ({
  name: userData.nickname,
  avatar: userData.avatar.src,
  status: "Online",
})
