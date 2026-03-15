"use client"

import type React from "react"
import { useEffect, useRef, useCallback, useState } from "react"
import { Check, Volume2, Mic, Headphones, Speaker, ChevronRight, Settings } from "lucide-react"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import "./device-context-menu.scss"

export interface AudioDevice {
  deviceId: string
  label: string
  kind: "audioinput" | "audiooutput" | "videoinput"
}

interface DeviceContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  onClose: () => void
  type: "microphone" | "speaker"
  inputDevices: AudioDevice[]
  outputDevices: AudioDevice[]
  selectedInputDeviceId: string
  selectedOutputDeviceId: string
  volume: number
  onInputDeviceSelect: (deviceId: string) => void
  onOutputDeviceSelect: (deviceId: string) => void
  onVolumeChange: (volume: number) => void
  onOpenSettings?: () => void
}

const VolumeSlider: React.FC<{
  value: number
  onChange: (value: number) => void
}> = ({ value, onChange }) => {
  const sliderRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const updateValue = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return
      const rect = sliderRef.current.getBoundingClientRect()
      const percentage = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
      onChange(Math.round(percentage))
    },
    [onChange],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true
      updateValue(e.clientX)
    },
    [updateValue],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        updateValue(e.clientX)
      }
    }

    const handleMouseUp = () => {
      isDragging.current = false
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [updateValue])

  return (
    <div ref={sliderRef} className="device-context-menu__slider" onMouseDown={handleMouseDown}>
      <div className="device-context-menu__slider-track">
        <div className="device-context-menu__slider-fill" style={{ width: `${value}%` }} />
      </div>
      <div className="device-context-menu__slider-thumb" style={{ left: `${value}%` }} />
    </div>
  )
}

const MicrophoneLevelIndicator: React.FC<{ volume: number }> = ({ volume }) => {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setLevel(Math.random() * (volume / 100) * 100)
    }, 100)

    return () => clearInterval(interval)
  }, [volume])

  return (
    <div className="device-context-menu__level-indicator">
      <div className="device-context-menu__level-bars">
        {[...Array(20)].map((_, i) => {
          const threshold = (i / 20) * 100
          const isActive = level > threshold

          let zoneClass = ""
          if (isActive) {
            if (i < 7) {
              zoneClass = "device-context-menu__level-bar--low"
            } else if (i < 14) {
              zoneClass = "device-context-menu__level-bar--medium"
            } else {
              zoneClass = "device-context-menu__level-bar--high"
            }
          }

          return (
            <div
              key={i}
              className={cn(
                "device-context-menu__level-bar",
                {
                  "device-context-menu__level-bar--active": isActive,
                  [zoneClass]: isActive,
                }
              )}
            />
          )
        })}
      </div>
    </div>
  )
}

// Подменю со списком устройств (только для текущего типа)
const DeviceSubMenu: React.FC<{
  deviceType: "microphone" | "speaker"
  inputDevices?: AudioDevice[]
  outputDevices?: AudioDevice[]
  selectedInputDeviceId: string
  selectedOutputDeviceId: string
  onInputDeviceSelect: (deviceId: string) => void
  onOutputDeviceSelect: (deviceId: string) => void
  t: (key: string) => string
}> = ({
  deviceType,
  inputDevices = [],
  outputDevices = [],
  selectedInputDeviceId,
  selectedOutputDeviceId,
  onInputDeviceSelect,
  onOutputDeviceSelect,
  t,
}) => {
  const isMicrophone = deviceType === "microphone"
  const devices = isMicrophone ? inputDevices : outputDevices
  const selectedId = isMicrophone ? selectedInputDeviceId : selectedOutputDeviceId
  const onSelect = isMicrophone ? onInputDeviceSelect : onOutputDeviceSelect
  const title = isMicrophone ? t("input_device") : t("output_device")

  const getDeviceIcon = (kind: string) => {
    if (kind === "audioinput") return <Mic size={14} />
    if (kind === "audiooutput") return <Headphones size={14} />
    return <Speaker size={14} />
  }

  return (
    <div className="device-context-menu__submenu">
      <div className="device-context-menu__submenu-content">
        <div className="device-context-menu__section-title">{title}</div>
        <div className="device-context-menu__devices">
          {devices.length > 0 ? (
            devices.map((device) => (
              <button
                key={device.deviceId}
                className={cn("device-context-menu__device", {
                  "device-context-menu__device--selected": device.deviceId === selectedId,
                })}
                onClick={() => onSelect(device.deviceId)}
              >
                <span className="device-context-menu__device-icon">{getDeviceIcon(device.kind)}</span>
                <span className="device-context-menu__device-name">
                  {device.label ||
                    `${device.kind === "audioinput" ? t("input_device") : t("output_device")} ${device.deviceId.slice(0, 8)}`}
                </span>
                {device.deviceId === selectedId && <Check size={14} className="device-context-menu__check" />}
              </button>
            ))
          ) : (
            <div className="device-context-menu__no-devices">{t("no_devices_found")}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export const DeviceContextMenu: React.FC<DeviceContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  type,
  inputDevices,
  outputDevices,
  selectedInputDeviceId,
  selectedOutputDeviceId,
  volume,
  onInputDeviceSelect,
  onOutputDeviceSelect,
  onVolumeChange,
  onOpenSettings,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation("settings")
  const [adjustedPos, setAdjustedPos] = useState({ x: position.x, y: position.y })
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false)
  const subMenuTimer = useRef<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    if (subMenuTimer.current) clearTimeout(subMenuTimer.current)
    setIsSubMenuOpen(true)
  }

  const handleMouseLeave = () => {
    subMenuTimer.current = setTimeout(() => {
      setIsSubMenuOpen(false)
    }, 150)
  }

  useEffect(() => {
    if (!isOpen || !menuRef.current) {
      setAdjustedPos(position)
      return
    }

    requestAnimationFrame(() => {
      if (!menuRef.current) return

      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth

      let newX = position.x
      let newY = position.y

      if (newX + rect.width > viewportWidth - 16) {
        newX = viewportWidth - rect.width - 16
      }
      if (newX < 16) {
        newX = 16
      }

      if (newY - rect.height < 16) {
        newY = rect.height + 16
      }

      setAdjustedPos({ x: newX, y: newY })
    })
  }, [isOpen, position])

  useEffect(() => {
    if (!isOpen) return

    const handleResize = () => {
      if (!menuRef.current) return

      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth

      let newX = adjustedPos.x

      if (newX + rect.width > viewportWidth - 16) {
        newX = viewportWidth - rect.width - 16
      }

      setAdjustedPos((prev) => ({ ...prev, x: newX }))
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isOpen, adjustedPos.x])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const DeviceIcon = type === "microphone" ? Mic : Headphones

  return (
    <div
      ref={menuRef}
      className="device-context-menu"
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y,
        transform: "translateY(-100%)",
      }}
    >
      <div className="device-context-menu__header">
        {type === "microphone" ? (
          <>
            <Mic size={16} />
            <span>{t("input_device")}</span>
          </>
        ) : (
          <>
            <Volume2 size={16} />
            <span>{t("output_device")}</span>
          </>
        )}
      </div>

      {/* Кнопка выбора устройств с иконкой типа */}
      <div
        ref={triggerRef}
        className="device-context-menu__device-selector"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button className="device-context-menu__selector-button">
          <span className="device-context-menu__selector-icon">
            <DeviceIcon size={14} />
          </span>
          <span className="device-context-menu__selector-text">{t("select_device")}</span>
          <ChevronRight
            size={16}
            className={cn("device-context-menu__selector-arrow", {
              "device-context-menu__selector-arrow--open": isSubMenuOpen,
            })}
          />
        </button>

        {isSubMenuOpen && (
          <DeviceSubMenu
            deviceType={type}
            inputDevices={inputDevices}
            outputDevices={outputDevices}
            selectedInputDeviceId={selectedInputDeviceId}
            selectedOutputDeviceId={selectedOutputDeviceId}
            onInputDeviceSelect={onInputDeviceSelect}
            onOutputDeviceSelect={onOutputDeviceSelect}
            t={t}
          />
        )}
      </div>

      <div className="device-context-menu__divider" />

      {type === "microphone" && (
        <>
          <div className="device-context-menu__section">
            <div className="device-context-menu__section-title">{t("input_volume")}</div>
            <MicrophoneLevelIndicator volume={volume} />
          </div>
          <div className="device-context-menu__divider" />
        </>
      )}

      <div className="device-context-menu__section">
        <div className="device-context-menu__section-title">
          {type === "microphone" ? t("input_volume") : t("output_volume")}
        </div>
        <div className="device-context-menu__volume">
          <VolumeSlider value={volume} onChange={onVolumeChange} />
        </div>
        {onOpenSettings && (
          <>
            <div className="device-context-menu__divider" />
            <button className="device-context-menu__settings-button" onClick={onOpenSettings}>
              <Settings size={16} />
              <span>{t("voice_video")}</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default DeviceContextMenu