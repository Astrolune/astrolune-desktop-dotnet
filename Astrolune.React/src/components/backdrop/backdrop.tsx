"use client"

import type React from "react"
import { createPortal } from "react-dom"
import "./backdrop.scss"
import cn from "classnames"

export interface BackdropProps {
  isClosing?: boolean
  visible?: boolean
  onClick?: () => void
  children: React.ReactNode
}

export function Backdrop({ isClosing = false, visible = true, onClick, children }: Readonly<BackdropProps>) {
  if (!visible) return null

  return createPortal(
    <div
      className={cn("backdrop", {
        "backdrop--closing": isClosing,
        "backdrop--windows": navigator.userAgent.includes("Windows"),
      })}
      onClick={onClick}
    >
      <div className="backdrop__content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
