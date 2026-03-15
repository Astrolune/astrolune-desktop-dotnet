"use client"

import { Minus, Square, X } from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import "./window-controls.scss"

const isTauriRuntime = () =>
  typeof window !== "undefined" && Object.prototype.hasOwnProperty.call(window, "__TAURI_INTERNALS__")

export const WindowControls = () => {
  if (!isTauriRuntime()) {
    return null
  }

  const appWindow = getCurrentWindow()

  const handleMinimize = async () => {
    try {
      await appWindow.minimize()

    } catch (error) {
      console.error("Failed to minimize window:", error)
    }
  }

  const handleMaximize = async () => {
    try {
      await appWindow.maximize()
    } catch (error) {
      console.error("Failed to maximize window:", error)
    }
  }

  const handleClose = async () => {
    try {
      await appWindow.close()
    } catch (error) {
      console.error("Failed to close window:", error)
    }
  }

  return (
    <div data-tauri-drag-region className="window-controls">
      <button
        className="window-controls__button window-controls__button--minimize"
        onClick={handleMinimize}
        id="titlebar-minimize"
        title="Minimize"
      >
        <Minus size={14} />
      </button>
      <button
        className="window-controls__button window-controls__button--maximize"
        onClick={handleMaximize}
        id="titlebar-maximize"
        title="Maximize"
      >
        <Square size={12} />
      </button>
      <button className="window-controls__button window-controls__button--close" onClick={handleClose} id="titlebar-close" title="Close">
        <X size={14} />
      </button>
    </div>
  )
}
