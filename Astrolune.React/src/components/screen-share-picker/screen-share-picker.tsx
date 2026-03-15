"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AppWindow, Check, Monitor, RotateCcw, Settings2, X } from "lucide-react"
import { Backdrop } from "../backdrop/backdrop"
import { Button } from "../button/button"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import { listCaptureSourcesNative, type CaptureSource } from "../../lib/media"
import "./screen-share-picker.scss"

export interface ScreenShareSettings {
  quality: "720p" | "1080p" | "1440p" | "4k"
  fps: "15" | "30" | "60"
  audio: boolean
}

export interface ScreenShareSelection {
  sourceId: string
  settings: ScreenShareSettings
  previewThumbnail?: string
}

interface ScreenSharePickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (selection: ScreenShareSelection) => void
}

const QUALITY_OPTIONS = [
  { value: "720p", label: "720p", desc: "HD" },
  { value: "1080p", label: "1080p", desc: "Full HD" },
  { value: "1440p", label: "1440p", desc: "2K" },
  { value: "4k", label: "4K", desc: "Ultra HD" },
] as const

const FPS_OPTIONS = [
  { value: "15", label: "15 FPS", desc: "Low" },
  { value: "30", label: "30 FPS", desc: "Standard" },
  { value: "60", label: "60 FPS", desc: "Smooth" },
] as const

const makeThumbnailDataUri = (thumbnail: string) => {
  if (!thumbnail) return ""
  if (thumbnail.startsWith("data:")) return thumbnail
  return `data:image/png;base64,${thumbnail}`
}

const getSourceKind = (source: CaptureSource): "monitor" | "window" => {
  const kind = String(source.kind ?? "").toLowerCase()
  if (kind.includes("window")) {
    return "window"
  }
  if (kind.includes("monitor") || kind.includes("screen") || kind.includes("display")) {
    return "monitor"
  }

  const id = String(source.id ?? "").toLowerCase()
  if (id.includes("window")) {
    return "window"
  }

  return "monitor"
}

export const ScreenSharePicker: React.FC<ScreenSharePickerProps> = ({
  visible,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation(["call", "modal", "settings"])
  const [showSettings, setShowSettings] = useState(true)
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState("")
  const [activeTab, setActiveTab] = useState<"monitor" | "window">("monitor")
  const [loadingSources, setLoadingSources] = useState(false)
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [settings, setSettings] = useState<ScreenShareSettings>({
    quality: "1080p",
    fps: "60",
    audio: true,
  })

  const monitors = useMemo(
    () => sources.filter((source) => getSourceKind(source) === "monitor"),
    [sources],
  )
  const windows = useMemo(
    () => sources.filter((source) => getSourceKind(source) === "window"),
    [sources],
  )
  const visibleSources = activeTab === "monitor" ? monitors : windows
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [selectedSourceId, sources],
  )

  const loadSources = useCallback(async () => {
    setLoadingSources(true)
    setSourceError(null)

    try {
      const nextSources = await listCaptureSourcesNative()
      setSources(nextSources)

      const nextMonitors = nextSources.filter((source) => getSourceKind(source) === "monitor")
      const nextWindows = nextSources.filter((source) => getSourceKind(source) === "window")

      if (nextMonitors.length > 0) {
        setActiveTab("monitor")
      } else if (nextWindows.length > 0) {
        setActiveTab("window")
      }

      setSelectedSourceId((previous) => {
        if (previous && nextSources.some((source) => source.id === previous)) {
          return previous
        }
        return nextSources[0]?.id ?? ""
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load capture sources"
      setSourceError(message)
      setSources([])
      setSelectedSourceId("")
    } finally {
      setLoadingSources(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    void loadSources()
  }, [loadSources, visible])

  useEffect(() => {
    if (visibleSources.length === 0) return
    if (selectedSourceId && visibleSources.some((source) => source.id === selectedSourceId)) {
      return
    }
    setSelectedSourceId(visibleSources[0]?.id ?? "")
  }, [selectedSourceId, visibleSources])

  const handleStart = useCallback(() => {
    if (!selectedSource) return
    onSelect({
      sourceId: selectedSource.id,
      settings,
      previewThumbnail: makeThumbnailDataUri(selectedSource.thumbnail),
    })
    onClose()
  }, [onClose, onSelect, selectedSource, settings])

  if (!visible) return null

  return (
    <Backdrop visible={visible} onClick={onClose}>
      <div className="screen-share-picker" onClick={(event) => event.stopPropagation()}>
        <div className="screen-share-picker__header">
          <h2 className="screen-share-picker__title">{t("screen_share")}</h2>
          <div className="screen-share-picker__header-actions">
            <button
              className={cn("screen-share-picker__settings-btn", {
                "screen-share-picker__settings-btn--active": showSettings,
              })}
              onClick={() => setShowSettings((prev) => !prev)}
            >
              <Settings2 size={16} />
            </button>
            <button className="screen-share-picker__close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="screen-share-picker__settings">
            <div className="screen-share-picker__settings-group">
              <label className="screen-share-picker__settings-label">
                {t("settings:screen_share_quality")}
              </label>
              <div className="screen-share-picker__options">
                {QUALITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={cn("screen-share-picker__option", {
                      "screen-share-picker__option--active":
                        settings.quality === option.value,
                    })}
                    onClick={() =>
                      setSettings((previous) => ({
                        ...previous,
                        quality: option.value,
                      }))
                    }
                  >
                    <span className="screen-share-picker__option-label">
                      {option.label}
                    </span>
                    <span className="screen-share-picker__option-desc">
                      {option.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="screen-share-picker__settings-group">
              <label className="screen-share-picker__settings-label">
                {t("settings:screen_share_fps")}
              </label>
              <div className="screen-share-picker__options">
                {FPS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={cn("screen-share-picker__option", {
                      "screen-share-picker__option--active": settings.fps === option.value,
                    })}
                    onClick={() =>
                      setSettings((previous) => ({
                        ...previous,
                        fps: option.value,
                      }))
                    }
                  >
                    <span className="screen-share-picker__option-label">
                      {option.label}
                    </span>
                    <span className="screen-share-picker__option-desc">
                      {option.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="screen-share-picker__settings-group">
              <label className="screen-share-picker__toggle-row">
                <span>{t("share_audio")}</span>
                <button
                  className={cn("screen-share-picker__toggle", {
                    "screen-share-picker__toggle--active": settings.audio,
                  })}
                  onClick={() =>
                    setSettings((previous) => ({
                      ...previous,
                      audio: !previous.audio,
                    }))
                  }
                >
                  <span className="screen-share-picker__toggle-handle" />
                </button>
              </label>
            </div>
          </div>
        )}

        <div className="screen-share-picker__tabs">
          <button
            className={cn("screen-share-picker__tab", {
              "screen-share-picker__tab--active": activeTab === "monitor",
            })}
            onClick={() => setActiveTab("monitor")}
          >
            <Monitor size={14} />
            <span>{t("screens")}</span>
            <span className="screen-share-picker__tab-count">{monitors.length}</span>
          </button>
          <button
            className={cn("screen-share-picker__tab", {
              "screen-share-picker__tab--active": activeTab === "window",
            })}
            onClick={() => setActiveTab("window")}
          >
            <AppWindow size={14} />
            <span>{t("windows")}</span>
            <span className="screen-share-picker__tab-count">{windows.length}</span>
          </button>
          <button className="screen-share-picker__tab" onClick={() => void loadSources()}>
            <RotateCcw size={14} />
            <span>{t("settings:refresh_devices")}</span>
          </button>
        </div>

        <div className="screen-share-picker__content">
          {loadingSources && (
            <div className="screen-share-picker__loading">
              <div className="screen-share-picker__spinner" />
              <span>{t("loading_sources")}</span>
            </div>
          )}

          {!loadingSources && sourceError && (
            <div className="screen-share-picker__empty">
              <span>{sourceError}</span>
            </div>
          )}

          {!loadingSources && !sourceError && visibleSources.length === 0 && (
            <div className="screen-share-picker__empty">
              <Monitor size={40} />
              <span>{t("no_sources")}</span>
            </div>
          )}

          {!loadingSources && !sourceError && visibleSources.length > 0 && (
            <div className="screen-share-picker__grid">
              {visibleSources.map((source) => {
                const selected = selectedSourceId === source.id
                return (
                  <button
                    key={source.id}
                    className={cn("screen-share-picker__source", {
                      "screen-share-picker__source--selected": selected,
                    })}
                    onClick={() => setSelectedSourceId(source.id)}
                  >
                    <div className="screen-share-picker__source-preview">
                      {source.thumbnail ? (
                        <img
                          src={makeThumbnailDataUri(source.thumbnail)}
                          alt={source.name}
                        />
                      ) : (
                        <div className="screen-share-picker__source-placeholder">
                          {getSourceKind(source) === "monitor" ? (
                            <Monitor size={28} />
                          ) : (
                            <AppWindow size={28} />
                          )}
                          <span>{source.name}</span>
                        </div>
                      )}
                      {selected && (
                        <div className="screen-share-picker__source-check">
                          <Check size={18} />
                        </div>
                      )}
                    </div>
                    <div className="screen-share-picker__source-info">
                      {getSourceKind(source) === "monitor" ? (
                        <Monitor className="screen-share-picker__source-icon" />
                      ) : (
                        <AppWindow className="screen-share-picker__source-icon" />
                      )}
                      <div className="screen-share-picker__source-meta">
                        <span className="screen-share-picker__source-name">{source.name}</span>
                        {source.width > 0 && source.height > 0 ? (
                          <small>{source.width}x{source.height}</small>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="screen-share-picker__footer">
          <Button theme="outline" onClick={onClose}>
            {t("modal:cancel")}
          </Button>
          <Button theme="primary" onClick={handleStart} disabled={!selectedSource}>
            {t("share")}
          </Button>
        </div>
      </div>
    </Backdrop>
  )
}

export default ScreenSharePicker
