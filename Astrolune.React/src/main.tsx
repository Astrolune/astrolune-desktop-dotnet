import React from "react"
import ReactDOM from "react-dom/client"
import { Provider } from "react-redux"
import { HashRouter, Navigate, Route, Routes } from "react-router-dom"

import App from "./app"
import { store } from "./lib"
import { closeToast } from "./lib"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
import i18n from "i18next"
import resources from "./locales"
import { useAppDispatch, useAppSelector } from "./hooks"
import { Toast } from "./components"

import { FriendsPage } from "./pages/friends/friends"
import { ChatPage } from "./pages/chat/chat"
import { AuthPage } from "./pages/auth/auth"
import { AnonymousRoute, ProtectedRoute } from "./pages/auth/auth-guards"
import { CallProvider } from "./contexts/call-context"
import { AuthProvider } from "./contexts/auth-context"
import "./scss/app.scss"

import "@fontsource/noto-sans/400.css"
import "@fontsource/noto-sans/500.css"
import "@fontsource/noto-sans/700.css"

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  })

const GlobalToast = () => {
  const toast = useAppSelector((state) => state.toast)
  const dispatch = useAppDispatch()

  return (
    <Toast
      visible={toast.visible}
      title={toast.title}
      message={toast.message}
      type={toast.type}
      onClose={() => dispatch(closeToast())}
      duration={toast.duration}
    />
  )
}

const Root = () => {
  return (
    <Provider store={store}>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route element={<AnonymousRoute />}>
              <Route path="/auth" element={<AuthPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <CallProvider>
                    <App />
                  </CallProvider>
                }
              >
                <Route path="/" element={<ChatPage />} />
                <Route path="/chat/:chatId?" element={<ChatPage />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/call" element={<Navigate to="/" replace />} />
                <Route path="/call/:roomId" element={<Navigate to="/" replace />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
        <GlobalToast />
      </AuthProvider>
    </Provider>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
