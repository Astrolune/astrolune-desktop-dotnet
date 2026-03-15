import { Navigate, Outlet } from "react-router-dom"

import { useAuthSession } from "../../contexts/auth-context"
import "./auth-guards.scss"

const AuthLoadingScreen = () => (
  <div className="auth-loading-screen">
    <div className="auth-loading-screen__pulse" />
    <p>Authorizing...</p>
  </div>
)

export const ProtectedRoute = () => {
  const { isLoading, isAuthenticated } = useAuthSession()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}

export const AnonymousRoute = () => {
  const { isLoading, isAuthenticated } = useAuthSession()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
