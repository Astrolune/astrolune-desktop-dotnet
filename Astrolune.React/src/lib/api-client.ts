import { fetchWithOptionalAuth } from "./auth/session"
import type { UserStatus } from "../types"

const DEFAULT_SERVICE_URLS = {
  auth: "http://localhost:5001/api/auth",
  user: "http://localhost:5002/api/users",
  guild: "http://localhost:5003/api/guilds",
  message: "http://localhost:5004/api/messages",
  media: "http://localhost:5005/api",
  realtime: "http://localhost:6000",
} as const

const normalizeMediaApiUrl = (value: string) => {
  const trimmed = value.replace(/\/+$/, "")
  if (trimmed.endsWith("/api/media")) {
    return trimmed.slice(0, -"/media".length)
  }
  return trimmed
}

const SERVICE_URLS = {
  auth: import.meta.env.VITE_AUTH_API_URL || DEFAULT_SERVICE_URLS.auth,
  user: import.meta.env.VITE_USER_API_URL || DEFAULT_SERVICE_URLS.user,
  guild: import.meta.env.VITE_GUILD_API_URL || DEFAULT_SERVICE_URLS.guild,
  message: import.meta.env.VITE_MESSAGE_API_URL || DEFAULT_SERVICE_URLS.message,
  media: normalizeMediaApiUrl(import.meta.env.VITE_MEDIA_API_URL || DEFAULT_SERVICE_URLS.media),
  realtime: import.meta.env.VITE_REALTIME_API_URL || DEFAULT_SERVICE_URLS.realtime,
} as const

export type ApiService = keyof typeof SERVICE_URLS
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
type AuthMode = "required" | "optional" | "none"

export type JsonRecord = Record<string, unknown>

const DEFAULT_RETRY_COUNT = 3
const DEFAULT_RETRY_DELAY_MS = 120

export interface ApiEnvelope<T> {
  success?: boolean
  ok?: boolean
  data?: T
  error?: string
  message?: string
  code?: string
  details?: Record<string, unknown>
}

export interface ApiRequestOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  service?: ApiService
  auth?: AuthMode
  retryCount?: number
  retryDelayMs?: number
  signal?: AbortSignal
}

export interface ApiError extends Error {
  status: number
  code?: string
  details?: Record<string, unknown>
}

export interface AuthUser {
  id: string
  username: string
  email: string
  displayName: string | null
  twoFactorEnabled: boolean
  emailVerified: boolean
  platformRole: string
}

export interface UserProfileDto {
  userId: string
  displayName: string
  bio: string
  avatar: string | null
  banner: string | null
}

export interface UpdateProfileRequest {
  displayName?: string | null
  bio?: string | null
  avatar?: string | null
  banner?: string | null
}

export interface FriendLinkDto {
  userId: string
  since: string
}

export interface Friend {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string | null
  status?: UserStatus
  activity?: {
    icon: string
    gameName: string
    startTime: number
    details?: string
  }
  since?: string
}

export interface GuildDto {
  id: string
  name: string
  ownerId: string
  icon: string | null
  createdAt: string
}

export interface CreateGuildRequest {
  name: string
  icon?: string | null
}

export interface UpdateGuildRequest {
  name?: string | null
  icon?: string | null
}

export type ChannelType = 0 | 1

export interface ChannelDto {
  id: string
  guildId: string
  name: string
  type: ChannelType
}

export interface CreateChannelRequest {
  name: string
  type: ChannelType
}

export interface CreateMessageRequest {
  channelId: string
  content: string
  attachments?: string[]
}

export interface EditMessageRequest {
  content: string
}

export interface MessageDto {
  messageId: string
  channelId: string
  authorId: string
  threadId: string | null
  parentMessageId: string | null
  content: string
  attachments: string[]
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  isDeleted: boolean
  reactions: Record<string, string[]>
  metadata: Record<string, string>
}

export interface JoinVoiceResponse {
  token: string
  url: string
  room: string
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const isBodyInit = (value: unknown): value is BodyInit => {
  if (!value) {
    return false
  }
  if (typeof value === "string") {
    return true
  }
  if (typeof FormData !== "undefined" && value instanceof FormData) {
    return true
  }
  if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) {
    return true
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return true
  }
  if (value instanceof ArrayBuffer) {
    return true
  }
  return ArrayBuffer.isView(value)
}

const createApiError = (
  message: string,
  status: number,
  code?: string,
  details?: Record<string, unknown>,
): ApiError => {
  const error = new Error(message) as ApiError
  error.name = "ApiError"
  error.status = status
  error.code = code
  error.details = details
  return error
}

const isApiError = (value: unknown): value is ApiError =>
  value instanceof Error && "status" in value && typeof (value as ApiError).status === "number"

const toResponseText = async (response: Response) => response.text().catch(() => "")

const parseResponsePayload = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    return (await toResponseText(response)) as T
  }

  const payload = (await response.json()) as unknown
  if (!isRecord(payload)) {
    return payload as T
  }

  if (payload.success === false || payload.ok === false) {
    throw createApiError(
      String(payload.error || payload.message || `Request failed with status ${response.status}`),
      response.status,
      typeof payload.code === "string" ? payload.code : undefined,
      isRecord(payload.details) ? payload.details : undefined,
    )
  }

  if ((payload.success === true || payload.ok === true) && "data" in payload) {
    return payload.data as T
  }

  return payload as T
}

const parseError = async (response: Response): Promise<ApiError> => {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as unknown
    if (isRecord(payload)) {
      return createApiError(
        String(payload.error || payload.message || `Request failed with status ${response.status}`),
        response.status,
        typeof payload.code === "string" ? payload.code : undefined,
        isRecord(payload.details) ? payload.details : undefined,
      )
    }
  }

  const text = await toResponseText(response)
  return createApiError(text || `Request failed with status ${response.status}`, response.status)
}

const buildUrl = (path: string, service: ApiService): string => {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const base = trimTrailingSlash(SERVICE_URLS[service])
  if (!path) {
    return base
  }

  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

const performFetch = async (
  url: string,
  init: RequestInit,
  auth: AuthMode,
): Promise<Response> => {
  if (auth === "none") {
    return fetch(url, {
      ...init,
      credentials: init.credentials ?? "include",
    })
  }

  return fetchWithOptionalAuth(url, init, true)
}

const requestWithRetry = async (
  url: string,
  options: ApiRequestOptions,
): Promise<Response> => {
  const method = options.method || "GET"
  const retryCount = Math.max(0, options.retryCount ?? DEFAULT_RETRY_COUNT)
  const retryDelayMs = Math.max(20, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS)
  const auth = options.auth || "required"

  const headers = new Headers(options.headers || {})
  const bodyIsBodyInit = isBodyInit(options.body)
  if (!headers.has("Content-Type") && method !== "GET" && method !== "DELETE" && !bodyIsBodyInit) {
    headers.set("Content-Type", "application/json")
  }

  const requestInit: RequestInit = {
    method,
    headers,
    credentials: "include",
    signal: options.signal,
  }

  if (options.body !== undefined && method !== "GET" && method !== "DELETE") {
    const isJson = headers.get("Content-Type")?.includes("application/json") ?? false
    if (isJson && !bodyIsBodyInit) {
      requestInit.body = JSON.stringify(options.body)
    } else {
      requestInit.body = options.body as BodyInit
    }
  }

  let attempt = 0
  let lastError: unknown = null

  while (attempt <= retryCount) {
    try {
      const response = await performFetch(url, requestInit, auth)
      if (response.status >= 500 && attempt < retryCount) {
        attempt += 1
        await sleep(retryDelayMs * 2 ** (attempt - 1))
        continue
      }
      return response
    } catch (error) {
      if (isApiError(error)) {
        throw error
      }

      lastError = error
      if (attempt >= retryCount) {
        break
      }

      attempt += 1
      await sleep(retryDelayMs * 2 ** (attempt - 1))
    }
  }

  if (lastError instanceof Error) {
    throw createApiError(lastError.message, 0)
  }

  throw createApiError("Request failed", 0)
}

const request = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const service = options.service || "auth"
  const url = buildUrl(path, service)
  const response = await requestWithRetry(url, options)

  if (!response.ok) {
    throw await parseError(response)
  }

  return parseResponsePayload<T>(response)
}

export const api = {
  request,
  auth: {
    getMe: () =>
      request<AuthUser>("/me", {
        service: "auth",
        auth: "required",
      }),
    register: (payload: JsonRecord) =>
      request<JsonRecord>("/register", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "none",
      }),
    login: (payload: JsonRecord) =>
      request<JsonRecord>("/login", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "none",
      }),
    refresh: (payload: JsonRecord) =>
      request<JsonRecord>("/refresh", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "none",
      }),
    logout: (payload: JsonRecord) =>
      request<JsonRecord>("/logout", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    setupTwoFactor: () =>
      request<JsonRecord>("/2fa/setup", {
        service: "auth",
        method: "POST",
        body: {},
        auth: "required",
      }),
    enableTwoFactor: (payload: JsonRecord) =>
      request<JsonRecord>("/2fa/enable", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    verifyTwoFactor: (payload: JsonRecord) =>
      request<JsonRecord>("/2fa/verify", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    disableTwoFactor: (payload: JsonRecord) =>
      request<JsonRecord>("/2fa/disable", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    requestPasswordReset: (payload: JsonRecord) =>
      request<JsonRecord>("/password/reset/request", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "none",
      }),
    confirmPasswordReset: (payload: JsonRecord) =>
      request<JsonRecord>("/password/reset/confirm", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "none",
      }),
    requestEmailVerify: (payload: JsonRecord) =>
      request<JsonRecord>("/email/verify/request", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    confirmEmailVerify: (payload: JsonRecord) =>
      request<JsonRecord>("/email/verify/confirm", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "none",
      }),
    webauthnChallenge: (payload: JsonRecord) =>
      request<JsonRecord>("/webauthn/challenge", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    webauthnRegister: (payload: JsonRecord) =>
      request<JsonRecord>("/webauthn/register", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    webauthnLogin: (payload: JsonRecord) =>
      request<JsonRecord>("/webauthn/login", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "none",
      }),
    registerFingerprint: (payload: JsonRecord) =>
      request<JsonRecord>("/fingerprint/register", {
        service: "auth",
        method: "POST",
        body: payload,
        auth: "required",
      }),
  },
  users: {
    getMe: () =>
      request<UserProfileDto>("/me", {
        service: "user",
        auth: "required",
      }),
    updateMe: (payload: UpdateProfileRequest) =>
      request<UserProfileDto>("/me", {
        service: "user",
        method: "PATCH",
        body: payload,
        auth: "required",
      }),
    getById: (userId: string) =>
      request<UserProfileDto>(`/${encodeURIComponent(userId)}`, {
        service: "user",
        auth: "optional",
      }),
    getFriendLinks: () =>
      request<FriendLinkDto[]>("/friends", {
        service: "user",
        auth: "required",
      }),
    addFriend: (friendId: string) =>
      request<{ ok: boolean }>(`/friends/${encodeURIComponent(friendId)}`, {
        service: "user",
        method: "POST",
        body: {},
        auth: "required",
      }),
    removeFriend: (friendId: string) =>
      request<{ ok: boolean }>(`/friends/${encodeURIComponent(friendId)}`, {
        service: "user",
        method: "DELETE",
        auth: "required",
      }),
    getSettings: () =>
      request<JsonRecord>("/settings", {
        service: "user",
        auth: "required",
      }),
    updateSettings: (payload: JsonRecord) =>
      request<JsonRecord>("/settings", {
        service: "user",
        method: "PUT",
        body: payload,
        auth: "required",
      }),
  },
  guilds: {
    list: () =>
      request<GuildDto[]>("/", {
        service: "guild",
        auth: "required",
      }),
    create: (payload: CreateGuildRequest) =>
      request<GuildDto>("/", {
        service: "guild",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    getById: (guildId: string) =>
      request<GuildDto>(`/${encodeURIComponent(guildId)}`, {
        service: "guild",
        auth: "required",
      }),
    update: (guildId: string, payload: UpdateGuildRequest) =>
      request<GuildDto>(`/${encodeURIComponent(guildId)}`, {
        service: "guild",
        method: "PATCH",
        body: payload,
        auth: "required",
      }),
    remove: (guildId: string) =>
      request<{ ok: boolean }>(`/${encodeURIComponent(guildId)}`, {
        service: "guild",
        method: "DELETE",
        auth: "required",
      }),
    listChannels: (guildId: string) =>
      request<ChannelDto[]>(`/${encodeURIComponent(guildId)}/channels`, {
        service: "guild",
        auth: "required",
      }),
    createChannel: (guildId: string, payload: CreateChannelRequest) =>
      request<ChannelDto>(`/${encodeURIComponent(guildId)}/channels`, {
        service: "guild",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    listRoles: (guildId: string) =>
      request<JsonRecord[]>(`/${encodeURIComponent(guildId)}/roles`, {
        service: "guild",
        auth: "required",
      }),
    createRole: (guildId: string, payload: JsonRecord) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/roles`, {
        service: "guild",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    addMember: (guildId: string, memberId: string) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/members/${encodeURIComponent(memberId)}`, {
        service: "guild",
        method: "POST",
        body: {},
        auth: "required",
      }),
    removeMember: (guildId: string, memberId: string) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/members/${encodeURIComponent(memberId)}`, {
        service: "guild",
        method: "DELETE",
        auth: "required",
      }),
    createInvite: (guildId: string, payload: JsonRecord) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/invites`, {
        service: "guild",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    joinInvite: (code: string) =>
      request<JsonRecord>(`/invites/${encodeURIComponent(code)}/join`, {
        service: "guild",
        method: "POST",
        body: {},
        auth: "required",
      }),
    createWebhook: (guildId: string, payload: JsonRecord) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/webhooks`, {
        service: "guild",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    listWebhooks: (guildId: string) =>
      request<JsonRecord[]>(`/${encodeURIComponent(guildId)}/webhooks`, {
        service: "guild",
        auth: "required",
      }),
    getMemberPermissions: (guildId: string, memberId: string) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/members/${encodeURIComponent(memberId)}/permissions`, {
        service: "guild",
        auth: "required",
      }),
    updateMemberRoles: (guildId: string, memberId: string, payload: JsonRecord) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/members/${encodeURIComponent(memberId)}/roles`, {
        service: "guild",
        method: "PUT",
        body: payload,
        auth: "required",
      }),
    createAuditLog: (guildId: string, payload: JsonRecord) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/audit-logs`, {
        service: "guild",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    listAuditLogs: (guildId: string, query?: { take?: number }) =>
      request<JsonRecord[]>(
        `/${encodeURIComponent(guildId)}/audit-logs${query?.take ? `?take=${encodeURIComponent(String(query.take))}` : ""}`,
        {
          service: "guild",
          auth: "required",
        },
      ),
    createTicket: (guildId: string, payload: JsonRecord) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/tickets`, {
        service: "guild",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    listTickets: (guildId: string) =>
      request<JsonRecord[]>(`/${encodeURIComponent(guildId)}/tickets`, {
        service: "guild",
        auth: "required",
      }),
    assignTicket: (guildId: string, ticketId: string, payload: JsonRecord) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/tickets/${encodeURIComponent(ticketId)}/assign`, {
        service: "guild",
        method: "PATCH",
        body: payload,
        auth: "required",
      }),
    updateTicketStatus: (guildId: string, ticketId: string, payload: JsonRecord) =>
      request<JsonRecord>(`/${encodeURIComponent(guildId)}/tickets/${encodeURIComponent(ticketId)}/status`, {
        service: "guild",
        method: "PATCH",
        body: payload,
        auth: "required",
      }),
  },
  messages: {
    listChannelMessages: (channelId: string, limit = 50, before?: string) =>
      request<MessageDto[]>(
        `/channels/${encodeURIComponent(channelId)}?limit=${encodeURIComponent(String(limit))}${
          before ? `&before=${encodeURIComponent(before)}` : ""
        }`,
        {
          service: "message",
          auth: "required",
        },
      ),
    create: (payload: CreateMessageRequest) =>
      request<MessageDto>("/", {
        service: "message",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    update: (channelId: string, messageId: string, payload: EditMessageRequest) =>
      request<MessageDto>(`/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}`, {
        service: "message",
        method: "PATCH",
        body: payload,
        auth: "required",
      }),
    remove: (channelId: string, messageId: string) =>
      request<{ ok: boolean }>(`/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}`, {
        service: "message",
        method: "DELETE",
        auth: "required",
      }),
    addReaction: (channelId: string, messageId: string, emoji: string) =>
      request<{ ok: boolean }>(`/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}/reactions`, {
        service: "message",
        method: "POST",
        body: { emoji },
        auth: "required",
      }),
    removeReaction: (channelId: string, messageId: string, emoji: string) =>
      request<{ ok: boolean }>(`/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}/reactions`, {
        service: "message",
        method: "DELETE",
        body: { emoji },
        auth: "required",
      }),
    addReactionById: (messageId: string, channelId: string, emoji: string) =>
      request<{ ok: boolean }>(`/${encodeURIComponent(messageId)}/reactions`, {
        service: "message",
        method: "POST",
        body: { channelId, emoji },
        auth: "required",
      }),
    removeReactionById: (messageId: string, emoji: string, channelId?: string) =>
      request<{ ok: boolean }>(
        `/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}${
          channelId ? `?channelId=${encodeURIComponent(channelId)}` : ""
        }`,
        {
          service: "message",
          method: "DELETE",
          auth: "required",
        },
      ),
    createThread: (channelId: string, messageId: string, payload: JsonRecord) =>
      request<JsonRecord>(`/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}/threads`, {
        service: "message",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    postThreadMessage: (threadId: string, payload: CreateMessageRequest) =>
      request<MessageDto>(`/threads/${encodeURIComponent(threadId)}/messages`, {
        service: "message",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    listThreadMessages: (threadId: string, limit = 50, before?: string) =>
      request<MessageDto[]>(
        `/threads/${encodeURIComponent(threadId)}/messages?limit=${encodeURIComponent(String(limit))}${
          before ? `&before=${encodeURIComponent(before)}` : ""
        }`,
        {
          service: "message",
          auth: "required",
        },
      ),
    getMessageTimeline: (channelId: string, messageId: string, limit = 50) =>
      request<MessageDto[]>(
        `/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}/timeline?limit=${encodeURIComponent(
          String(limit),
        )}`,
        {
          service: "message",
          auth: "required",
        },
      ),
    search: (query: string, channelId?: string, limit = 20) =>
      request<MessageDto[]>(
        `/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}${
          channelId ? `&channelId=${encodeURIComponent(channelId)}` : ""
        }`,
        {
          service: "message",
          auth: "required",
        },
      ),
  },
  media: {
    upload: (formData: FormData) =>
      request<JsonRecord>("/media/upload", {
        service: "media",
        method: "POST",
        body: formData,
        auth: "required",
      }),
    createUploadUrl: (payload: JsonRecord) =>
      request<JsonRecord>("/media/upload-url", {
        service: "media",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    completeUpload: (payload: JsonRecord) =>
      request<JsonRecord>("/media/complete", {
        service: "media",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    resizeImage: (payload: JsonRecord) =>
      request<JsonRecord>("/media/images/resize", {
        service: "media",
        method: "POST",
        body: payload,
        auth: "required",
      }),
    uploadAvatar: (formData: FormData) =>
      request<JsonRecord>("/users/@me/avatar", {
        service: "media",
        method: "POST",
        body: formData,
        auth: "required",
      }),
    uploadBanner: (formData: FormData) =>
      request<JsonRecord>("/users/@me/banner", {
        service: "media",
        method: "POST",
        body: formData,
        auth: "required",
      }),
    joinVoice: (channelId: string, identitySuffix?: string) =>
      request<JoinVoiceResponse>("/voice/join", {
        service: "media",
        method: "POST",
        body: { channelId, identitySuffix: identitySuffix ?? null },
        auth: "required",
      }),
  },
}

export const apiConfig = {
  services: SERVICE_URLS,
}

export type { UserStatus } from "../types"
