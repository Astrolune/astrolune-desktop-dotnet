import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"

import { Button, TextField, WindowControls } from "../../components"
import { useAuthSession } from "../../contexts/auth-context"
import { useToast } from "../../hooks"
import { isDesktopBridgeAvailable, openDesktopAuthClient } from "../../lib/auth/session"

import "./auth.scss"

type AuthMode = "login" | "register"

export const AuthPage = () => {
  const { signIn, signUp, error } = useAuthSession()
  const { showSuccessToast, showErrorToast } = useToast()
  const [mode, setMode] = useState<AuthMode>("login")
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lastErrorRef = useRef<string | null>(null)
  const isDesktopAuth = isDesktopBridgeAvailable()

  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoaded(true)
    }, 100)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (!error) {
      lastErrorRef.current = null
      return
    }

    if (lastErrorRef.current === error) {
      return
    }

    lastErrorRef.current = error
    showErrorToast("Authentication error", error, 5000)
  }, [error, showErrorToast])

  const canSubmit = useMemo(() => {
    if (mode === "login") {
      return Boolean(login.trim() && password)
    }

    return Boolean(username.trim() && email.trim() && password)
  }, [email, login, mode, password, username])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === "login") {
        await signIn({ login, password })
        return
      }

      await signUp({
        username,
        email,
        password,
        displayName: displayName.trim() ? displayName.trim() : undefined,
      })

      showSuccessToast("Account created", "Welcome to Astrolune.", 3000)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Authentication failed"
      showErrorToast("Authentication error", message, 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenAuthClient = async () => {
    setIsSubmitting(true)

    try {
      const opened = await openDesktopAuthClient(mode)
      if (!opened) {
        showErrorToast("Authentication error", "Desktop auth client is unavailable.", 4000)
        return
      }

      showSuccessToast(
        "Continue in browser",
        mode === "login"
          ? "Complete the sign in flow to continue."
          : "Complete the sign up flow to continue.",
        4000,
      )
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Authentication failed"
      showErrorToast("Authentication error", message, 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = mode === "login" ? "Sign in" : "Create account"
  const subtitle =
    mode === "login"
      ? "Use your Astrolune credentials to continue."
      : "Create a new Astrolune account to continue."
  const submitLabel = mode === "login" ? "Sign in" : "Create account"
  const switchLabel = mode === "login" ? "Create account" : "Back to sign in"

  return (
    <>
      <div data-tauri-drag-region className="title-bar">
        <h4>
          Astro<span className="title-bar__infinity-text">Lune</span>
        </h4>
        <WindowControls />
      </div>

      <div className="authPageContainer">
        <div className="glowEffect" />

        <div className={`authContent ${isLoaded ? "fadeIn" : ""}`}>
          <div className="logoContainer" />

          <h1 className="title">{title}</h1>
          <p className="subtitle">{subtitle}</p>

          {isDesktopAuth ? (
            <div className="form">
              <p className="subtitle">
                We will open the secure auth client in your browser to finish signing in.
              </p>
              <Button
                type="button"
                className="actionButton"
                theme="outline"
                onClick={handleOpenAuthClient}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Please wait..." : submitLabel}
              </Button>
            </div>
          ) : (
            <>
              <form className="form" onSubmit={handleSubmit}>
                {mode === "register" && (
                  <>
                    <TextField
                      label="Username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="username"
                      autoComplete="username"
                      required
                    />

                    <TextField
                      label="Email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="email@example.com"
                      autoComplete="email"
                      required
                    />

                    <TextField
                      label="Display name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Optional"
                      autoComplete="name"
                    />
                  </>
                )}

                {mode === "login" && (
                  <TextField
                    label="Username or email"
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    placeholder="username or email"
                    autoComplete="username"
                    required
                  />
                )}

                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />

                <Button
                  type="submit"
                  className="actionButton"
                  theme="outline"
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? "Please wait..." : submitLabel}
                </Button>
              </form>

              <div className="dividerWithPseudo">
                <span className="dividerText">or</span>
              </div>
            </>
          )}

          <Button
            type="button"
            className="secondaryButton"
            theme="dark"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            disabled={isSubmitting}
          >
            {switchLabel}
          </Button>
        </div>
      </div>
    </>
  )
}
