import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
  applyExternalAuthTokens,
  clearStoredTokens,
  initializeAuthSession,
  isUnauthorizedError,
  isDesktopBridgeAvailable,
  loadCurrentUser,
  login,
  logout,
  register,
  type AuthUser,
} from "../lib/auth/session"
import { listen, type UnlistenFn } from "../lib/tauri/event"

type AuthStatus = "loading" | "authenticated" | "unauthenticated"

interface SignInPayload {
  login: string
  password: string
}

interface SignUpPayload {
  username: string
  email: string
  password: string
  displayName?: string
}

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (payload: SignInPayload) => Promise<void>
  signUp: (payload: SignUpPayload) => Promise<void>
  signOut: () => Promise<void>
  reloadUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const normalizeErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }
  return "Authentication failed"
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExternalAuth = useCallback(async (payload: unknown) => {
    setStatus("loading")
    setError(null)

    try {
      const session = await applyExternalAuthTokens(payload)
      setUser(session.user)
      setStatus("authenticated")
    } catch (applyError) {
      setUser(null)
      setStatus("unauthenticated")
      setError(normalizeErrorMessage(applyError))
    }
  }, [])

  const bootstrap = useCallback(async () => {
    setStatus("loading")
    setError(null)

    try {
      const session = await initializeAuthSession()
      if (!session) {
        setUser(null)
        setStatus("unauthenticated")
        return
      }

      setUser(session.user)
      setStatus("authenticated")
    } catch (bootstrapError) {
      if (isUnauthorizedError(bootstrapError)) {
        await clearStoredTokens()
        setUser(null)
        setStatus("unauthenticated")
        return
      }

      setUser(null)
      setStatus("unauthenticated")
      setError(normalizeErrorMessage(bootstrapError))
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (cancelled) {
        return
      }

      await bootstrap()
    })()

    return () => {
      cancelled = true
    }
  }, [bootstrap])

  useEffect(() => {
    if (!isDesktopBridgeAvailable()) {
      return
    }

    let unlisten: UnlistenFn | null = null
    let disposed = false

    void (async () => {
      try {
        unlisten = await listen("auth://callback", (payload) => {
          if (disposed) {
            return
          }

          void handleExternalAuth(payload)
        })
      } catch (listenError) {
        if (!disposed) {
          setError(normalizeErrorMessage(listenError))
        }
      }
    })()

    return () => {
      disposed = true
      if (unlisten) {
        unlisten()
      }
    }
  }, [handleExternalAuth])

  const signIn = useCallback(async ({ login: loginValue, password }: SignInPayload) => {
    setError(null)
    const session = await login(loginValue, password)
    setUser(session.user)
    setStatus("authenticated")
  }, [])

  const signUp = useCallback(async ({ username, email, password, displayName }: SignUpPayload) => {
    setError(null)
    const session = await register({ username, email, password, displayName })
    setUser(session.user)
    setStatus("authenticated")
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    await logout()
    setUser(null)
    setStatus("unauthenticated")
  }, [])

  const reloadUser = useCallback(async () => {
    setError(null)

    try {
      const currentUser = await loadCurrentUser()
      setUser(currentUser)
      setStatus("authenticated")
    } catch (reloadError) {
      if (isUnauthorizedError(reloadError)) {
        await clearStoredTokens()
        setUser(null)
        setStatus("unauthenticated")
        return
      }

      setError(normalizeErrorMessage(reloadError))
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      isLoading: status === "loading",
      isAuthenticated: status === "authenticated",
      signIn,
      signUp,
      signOut,
      reloadUser,
    }),
    [error, reloadUser, signIn, signOut, signUp, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuthSession = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuthSession must be used within AuthProvider")
  }

  return context
}
