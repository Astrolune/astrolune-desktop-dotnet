import { useCallback } from "react"

import { useAuthSession } from "../contexts/auth-context"
import { refreshAuthSession } from "../lib/auth/session"

export function useAuth() {
  const { user, isLoading, error, signIn, signOut, signUp, reloadUser } = useAuthSession()

  const signInWithPassword = useCallback(
    (login: string, password: string) => signIn({ login, password }),
    [signIn],
  )

  const signUpWithPassword = useCallback(
    (email: string, password: string, username: string, displayName?: string) =>
      signUp({ username, email, password, displayName }),
    [signUp],
  )

  const refreshToken = useCallback(() => refreshAuthSession(), [])

  const notImplemented = useCallback(async () => {
    throw new Error("Password recovery endpoints are not integrated in this client yet")
  }, [])

  return {
    signUp: signUpWithPassword,
    signIn: signInWithPassword,
    signOut,
    getCurrentUser: reloadUser,
    refreshToken,
    resetPassword: notImplemented,
    updatePassword: notImplemented,
    user,
    loading: isLoading,
    error,
  }
}
