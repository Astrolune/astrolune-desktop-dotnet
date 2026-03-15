"use client"

import React, { useEffect, useRef, useCallback } from "react"
import { ChevronRight } from "lucide-react"
import "./context-menu.scss"

interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  subMenu?: ContextMenuItem[]
  isEmoji?: boolean
  shortcut?: string
  disabled?: boolean
  separator?: boolean
}

interface ContextMenuProps {
  position: { x: number; y: number }
  items: ContextMenuItem[]
  onClose: () => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ position, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [activeSubmenu, setActiveSubmenu] = React.useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) && onClose) {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [handleClickOutside])

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect()
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      let adjustedX = position.x
      let adjustedY = position.y

      if (position.x + menuRect.width > windowWidth - 10) {
        adjustedX = windowWidth - menuRect.width - 10
      }

      if (position.y + menuRect.height > windowHeight - 10) {
        adjustedY = windowHeight - menuRect.height - 10
      }

      if (adjustedX < 10) adjustedX = 10
      if (adjustedY < 10) adjustedY = 10

      menuRef.current.style.left = `${adjustedX}px`
      menuRef.current.style.top = `${adjustedY}px`
    }
  }, [position])

  const handleItemClick = (item: ContextMenuItem, index: number) => {
    if (item.disabled) return

    if (item.subMenu) {
      setActiveSubmenu(activeSubmenu === index ? null : index)
    } else if (item.onClick) {
      item.onClick()
      onClose()
    }
  }

  const isEmojiSubmenu = (items: ContextMenuItem[]) => {
    return items.some((item) => item.isEmoji)
  }

  return (
    <div
      className="context-menu"
      ref={containerRef}
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={index} className="context-menu__separator" />
        }

        return (
          <div key={index} className="context-menu__item-container">
            <div
              className={`context-menu__item ${item.danger ? "context-menu__item--danger" : ""} ${item.disabled ? "context-menu__item--disabled" : ""}`}
              onClick={() => handleItemClick(item, index)}
              onMouseEnter={() => item.subMenu && setActiveSubmenu(index)}
            >
              {item.icon && <span className="context-menu__item-icon">{item.icon}</span>}
              <span className="context-menu__item-label">{item.label}</span>
              {item.shortcut && <span className="context-menu__item-shortcut">{item.shortcut}</span>}
              {item.subMenu && <ChevronRight size={14} className="context-menu__item-arrow" />}
            </div>

            {item.subMenu && activeSubmenu === index && (
              <div
                className={`context-menu__submenu ${isEmojiSubmenu(item.subMenu) ? "context-menu__emoji-submenu" : ""}`}
              >
                {item.subMenu.map((subItem, subIndex) => (
                  <div
                    key={subIndex}
                    className={`${subItem.isEmoji ? "context-menu__emoji-item" : "context-menu__item"} ${subItem.danger ? "context-menu__item--danger" : ""}`}
                    onClick={() => {
                      if (subItem.onClick) {
                        subItem.onClick()
                        onClose()
                      }
                    }}
                  >
                    {!subItem.isEmoji && subItem.icon && (
                      <span className="context-menu__item-icon">{subItem.icon}</span>
                    )}
                    <span className={subItem.isEmoji ? "" : "context-menu__item-label"}>{subItem.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
