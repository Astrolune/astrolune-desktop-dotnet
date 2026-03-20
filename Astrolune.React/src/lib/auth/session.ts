import { invoke } from "../tauri/core"

const DEFAULT_AUTH_API_URL = "http://localhost:5001/api/auth"
const TOKEN_STORE_SERVICE = "com.astrolune.app"
const TOKEN_STORE_ACCESS_KEY = "desktop-auth-session:access"
const TOKEN_STORE_REFRESH_KEY = "desktop-auth-session:refresh"

export interface AuthTokens {
  accessToken: string
  refreshToken: string
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

export interface AuthSession {
  tokens: AuthTokens
  user: AuthUser
}

export type DesktopAuthMode = "login" | "register"

class AuthHttpError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "AuthHttpError"
    this.status = status
  }
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const resolveAuthApiBaseUrl = () => {
  const configuredAuthApiUrl = import.meta.env.VITE_AUTH_API_URL as string | undefined
  if (configuredAuthApiUrl) {
    return trimTrailingSlash(configuredAuthApiUrl)
  }

  const legacyApiUrl = import.meta.env.VITE_API_URL as string | undefined
  if (!legacyApiUrl) {
    return DEFAULT_AUTH_API_URL
  }

  const normalizedLegacyUrl = trimTrailingSlash(legacyApiUrl)
  if (/\/api\/v1$/i.test(normalizedLegacyUrl)) {
    return normalizedLegacyUrl.replace(/\/api\/v1$/i, "/api/auth")
  }

  if (/\/api$/i.test(normalizedLegacyUrl)) {
    return `${normalizedLegacyUrl}/auth`
  }

  return `${normalizedLegacyUrl}/api/auth`
}

const AUTH_API_BASE_URL = resolveAuthApiBaseUrl()

const isTauriRuntime = () =>
  typeof window !== "undefined" &&
  (Boolean((window as Record<string, unknown>).__TAURI__) ||
    Boolean((window as Record<string, unknown>).__TAURI_INTERNALS__?.invoke))

export const isDesktopBridgeAvailable = () =>
  typeof window !== "undefined" && Boolean(window.chrome?.webview)

const readString = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string") {
      return value
    }
  }
  return null
}

const readBoolean = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "boolean") {
      return value
    }
  }
  return false
}

const decodeJwtExpiryUnix = (token: string) => {
  const encodedPayload = token.split(".")[1]
  if (!encodedPayload) {
    return null
  }

  try {
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>
    return typeof payload.exp === "number" ? payload.exp : null
  } catch {
    return null
  }
}

const isAccessTokenExpiringSoon = (accessToken: string, thresholdSeconds = 45) => {
  const expiresAtUnix = decodeJwtExpiryUnix(accessToken)
  if (!expiresAtUnix) {
    return false
  }

  const nowUnix = Math.floor(Date.now() / 1000)
  return expiresAtUnix <= nowUnix + thresholdSeconds
}

const toHeaders = (headers?: HeadersInit) => new Headers(headers ?? {})

const extractErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") {
    return fallback
  }

  const value = payload as Record<string, unknown>
  return (
    readString(value, "error", "message", "title", "detail") ??
    readString(value, "Error", "Message", "Title", "Detail") ??
    fallback
  )
}

const requestJson = async <T>(path: string, init: RequestInit): Promise<T> => {
  const headers = toHeaders(init.headers)
  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  })

  const contentType = response.headers.get("content-type") ?? ""
  const hasJson = contentType.includes("application/json")
  const payload = hasJson ? await response.json() : null

  if (!response.ok) {
    throw new AuthHttpError(
      extractErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status,
    )
  }

  return payload as T
}

const normalizeUser = (payload: unknown): AuthUser => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Auth response does not include a user payload")
  }

  const raw = payload as Record<string, unknown>
  return {
    id: readString(raw, "id", "Id") ?? "",
    username: readString(raw, "username", "Username") ?? "",
    email: readString(raw, "email", "Email") ?? "",
    displayName: readString(raw, "displayName", "DisplayName"),
    twoFactorEnabled: readBoolean(raw, "twoFactorEnabled", "TwoFactorEnabled"),
    emailVerified: readBoolean(raw, "emailVerified", "EmailVerified"),
    platformRole: readString(raw, "platformRole", "PlatformRole") ?? "user",
  }
}

const normalizeAuthTokens = (payload: unknown): AuthTokens | null => {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const raw = payload as Record<string, unknown>
  const accessToken = readString(raw, "accessToken", "AccessToken", "access_token")
  const refreshToken = readString(raw, "refreshToken", "RefreshToken", "refresh_token")

  if (!accessToken || !refreshToken) {
    return null
  }

  return { accessToken, refreshToken }
}

const normalizeAuthSession = (payload: unknown): AuthSession => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Authentication response is invalid")
  }

  const raw = payload as Record<string, unknown>

  const requiresTwoFactor = readBoolean(raw, "requiresTwoFactor", "RequiresTwoFactor")
  if (requiresTwoFactor) {
    throw new Error("Для входа требуется двухфакторная аутентификация")
  }

  const tokens = normalizeAuthTokens(raw)
  if (!tokens) {
    throw new Error("Authentication response does not include tokens")
  }

  const userPayload = raw.user ?? raw.User
  const user = normalizeUser(userPayload)

  return { tokens, user }
}

let cachedTokens: AuthTokens | null = null
let tokensHydrated = false
let refreshInFlight: Promise<AuthTokens | null> | null = null

let keyringModulePromise: Promise<typeof import("tauri-plugin-keyring-api")> | null = null

const getKeyringModule = async () => {
  if (!isTauriRuntime()) {
    return null
  }

  if (!keyringModulePromise) {
    keyringModulePromise = import("tauri-plugin-keyring-api")
  }

  return keyringModulePromise
}

const readPassword = async (key: string) => {
  if (isDesktopBridgeAvailable()) {
    try {
      return await invoke<string | null>("keyring_get_password", {
        service: TOKEN_STORE_SERVICE,
        key,
      })
    } catch (error) {
      console.warn("Failed to read token from desktop keyring.", error)
      return null
    }
  }

  const keyring = await getKeyringModule()
  if (!keyring) {
    return null
  }

  try {
    return await keyring.getPassword(TOKEN_STORE_SERVICE, key)
  } catch (error) {
    console.warn("Failed to read token from keyring.", error)
    return null
  }
}

const persistTokens = async (tokens: AuthTokens) => {
  cachedTokens = tokens

  if (isDesktopBridgeAvailable()) {
    try {
      await Promise.all([
        invoke("keyring_set_password", {
          service: TOKEN_STORE_SERVICE,
          key: TOKEN_STORE_ACCESS_KEY,
          password: tokens.accessToken,
        }),
        invoke("keyring_set_password", {
          service: TOKEN_STORE_SERVICE,
          key: TOKEN_STORE_REFRESH_KEY,
          password: tokens.refreshToken,
        }),
      ])
    } catch (error) {
      console.warn("Failed to persist tokens in desktop keyring.", error)
    }
    return
  }

  if (!isTauriRuntime()) {
    return
  }

  try {
    const keyring = await getKeyringModule()
    if (!keyring) {
      return
    }

    await Promise.all([
      keyring.setPassword(TOKEN_STORE_SERVICE, TOKEN_STORE_ACCESS_KEY, tokens.accessToken),
      keyring.setPassword(TOKEN_STORE_SERVICE, TOKEN_STORE_REFRESH_KEY, tokens.refreshToken),
    ])
  } catch (error) {
    console.warn("Failed to persist tokens in keyring.", error)
  }
}

const hydrateTokens = async () => {
  if (tokensHydrated) {
    return cachedTokens
  }

  tokensHydrated = true

  if (!isTauriRuntime()) {
    return cachedTokens
  }

  const [accessToken, refreshToken] = await Promise.all([
    readPassword(TOKEN_STORE_ACCESS_KEY),
    readPassword(TOKEN_STORE_REFRESH_KEY),
  ])

  if (accessToken && refreshToken) {
    cachedTokens = { accessToken, refreshToken }
  }

  return cachedTokens
}

export const clearStoredTokens = async () => {
  cachedTokens = null
  tokensHydrated = true

  if (isDesktopBridgeAvailable()) {
    try {
      await Promise.all([
        invoke("keyring_delete_password", {
          service: TOKEN_STORE_SERVICE,
          key: TOKEN_STORE_ACCESS_KEY,
        }).catch(() => null),
        invoke("keyring_delete_password", {
          service: TOKEN_STORE_SERVICE,
          key: TOKEN_STORE_REFRESH_KEY,
        }).catch(() => null),
      ])
    } catch (error) {
      console.warn("Failed to clear desktop keyring tokens.", error)
    }
    return
  }

  if (!isTauriRuntime()) {
    return
  }

  try {
    const keyring = await getKeyringModule()
    if (!keyring) {
      return
    }

    await Promise.all([
      keyring.deletePassword(TOKEN_STORE_SERVICE, TOKEN_STORE_ACCESS_KEY).catch(() => null),
      keyring.deletePassword(TOKEN_STORE_SERVICE, TOKEN_STORE_REFRESH_KEY).catch(() => null),
    ])
  } catch (error) {
    console.warn("Failed to clear keyring tokens.", error)
  }
}

export const getStoredTokens = async () => hydrateTokens()

export const openDesktopAuthClient = async (mode: DesktopAuthMode = "login") => {
  if (!isDesktopBridgeAvailable()) {
    return false
  }

  await invoke("open_auth_client", { mode })
  return true
}

export const applyExternalAuthTokens = async (payload: unknown): Promise<AuthSession> => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Authentication callback payload is missing.")
  }

  const raw = payload as Record<string, unknown>
  const error = readString(raw, "error", "Error", "message", "Message")
  if (error) {
    throw new Error(error)
  }

  const tokens = normalizeAuthTokens(raw)
  if (!tokens) {
    throw new Error("Authentication callback did not include tokens.")
  }

  await persistTokens(tokens)
  const user = await loadCurrentUser()
  return { tokens, user }
}
export const refreshAuthSession = async (): Promise<AuthTokens | null> => {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const currentTokens = await hydrateTokens()
    if (!currentTokens?.refreshToken) {
      return null
    }

    try {
      const payload = await requestJson<unknown>("/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: currentTokens.refreshToken }),
      })

      const session = normalizeAuthSession(payload)
      await persistTokens(session.tokens)
      return session.tokens
    } catch (error) {
      await clearStoredTokens()
      throw error
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

export const getAccessToken = async () => {
  const currentTokens = await hydrateTokens()
  if (!currentTokens?.accessToken) {
    return null
  }

  if (!isAccessTokenExpiringSoon(currentTokens.accessToken)) {
    return currentTokens.accessToken
  }

  try {
    const refreshed = await refreshAuthSession()
    return refreshed?.accessToken ?? null
  } catch {
    return null
  }
}

export const fetchWithOptionalAuth = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  retryOnUnauthorized = true,
) => {
  const headers = toHeaders(init.headers)
  const token = await getAccessToken()

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const firstResponse = await fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  })

  if (!retryOnUnauthorized || firstResponse.status !== 401 || !token) {
    return firstResponse
  }

  try {
    const refreshed = await refreshAuthSession()
    if (!refreshed?.accessToken) {
      return firstResponse
    }

    const retryHeaders = toHeaders(init.headers)
    retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`)

    return fetch(input, {
      ...init,
      headers: retryHeaders,
      credentials: init.credentials ?? "include",
    })
  } catch {
    return firstResponse
  }
}

export const fetchWithRequiredAuth = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = await getAccessToken()
  if (!token) {
    throw new AuthHttpError("Authentication required", 401)
  }

  const headers = toHeaders(init.headers)
  headers.set("Authorization", `Bearer ${token}`)

  const firstResponse = await fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  })

  if (firstResponse.status !== 401) {
    return firstResponse
  }

  const refreshed = await refreshAuthSession()
  if (!refreshed?.accessToken) {
    return firstResponse
  }

  const retryHeaders = toHeaders(init.headers)
  retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`)

  return fetch(input, {
    ...init,
    headers: retryHeaders,
    credentials: init.credentials ?? "include",
  })
}

export const login = async (loginValue: string, password: string) => {
  const payload = await requestJson<unknown>("/login", {
    method: "POST",
    body: JSON.stringify({
      login: loginValue.trim(),
      password,
      twoFactorCode: null,
      fingerprint: null,
    }),
  })

  const session = normalizeAuthSession(payload)
  await persistTokens(session.tokens)
  return session
}

export const register = async (params: {
  username: string
  email: string
  password: string
  displayName?: string
}) => {
  const payload = await requestJson<unknown>("/register", {
    method: "POST",
    body: JSON.stringify({
      username: params.username.trim(),
      email: params.email.trim(),
      password: params.password,
      displayName: params.displayName?.trim() || null,
    }),
  })

  const session = normalizeAuthSession(payload)
  await persistTokens(session.tokens)
  return session
}

export const loadCurrentUser = async () => {
  const token = await getAccessToken()
  if (!token) {
    throw new AuthHttpError("Authentication required", 401)
  }

  const payload = await requestJson<unknown>("/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  return normalizeUser(payload)
}

export const initializeAuthSession = async (): Promise<AuthSession | null> => {
  const currentTokens = await hydrateTokens()
  if (!currentTokens) {
    return null
  }

  try {
    const user = await loadCurrentUser()
    return { tokens: currentTokens, user }
  } catch (error) {
    if (!(error instanceof AuthHttpError) || error.status !== 401) {
      throw error
    }

    const refreshed = await refreshAuthSession().catch(() => null)
    if (!refreshed) {
      return null
    }

    const user = await loadCurrentUser()
    return { tokens: refreshed, user }
  }
}

export const logout = async () => {
  const currentTokens = await hydrateTokens()

  if (currentTokens) {
    try {
      await requestJson("/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentTokens.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: currentTokens.refreshToken }),
      })
    } catch {
      // Intentionally ignored to avoid blocking local logout.
    }
  }

  await clearStoredTokens()
}

export const isUnauthorizedError = (error: unknown) =>
  error instanceof AuthHttpError && (error.status === 401 || error.status === 403)

export const getAuthApiBaseUrl = () => AUTH_API_BASE_URL


