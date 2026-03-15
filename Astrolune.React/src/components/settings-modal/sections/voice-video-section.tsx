"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Mic, Volume2, Camera, Video, Monitor, Headphones, Play, Square, Zap, Check, RefreshCw } from "lucide-react"
import { CheckboxField } from "../../checkbox-field/checkbox-field"
import { Button } from "../../button/button"
import { AudioLevelIndicator } from "../../audio-level-indicator/audio-level-indicator"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import "./voice-video-section.scss"

interface AudioDevice {
  deviceId: string
  label: string
  kind: "audioinput" | "audiooutput" | "videoinput"
}

interface VoiceVideoSectionProps {
  // Device settings
  audioDevices: AudioDevice[]
  selectedMicId: string
  selectedSpeakerId: string
  selectedCameraId: string
  onMicChange: (deviceId: string) => void
  onSpeakerChange: (deviceId: string) => void
  onCameraChange: (deviceId: string) => void
  onRefreshDevices: () => void

  // Volume settings
  inputVolume: number
  outputVolume: number
  onInputVolumeChange: (value: number) => void
  onOutputVolumeChange: (value: number) => void

  // Voice processing
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGainControl: boolean
  voiceActivityDetection: boolean
  hardwareMute: boolean
  autoAdjustMic: boolean
  pushToTalk: boolean
  onNoiseSuppressionChange: (value: boolean) => void
  onEchoCancellationChange: (value: boolean) => void
  onAutoGainControlChange: (value: boolean) => void
  onVoiceActivityDetectionChange: (value: boolean) => void
  onHardwareMuteChange: (value: boolean) => void
  onAutoAdjustMicChange: (value: boolean) => void
  onPushToTalkChange: (value: boolean) => void

  // Video settings
  videoQuality: string
  videoFps: string
  screenShareQuality: string
  screenShareFps: string
  hardwareAcceleration: boolean
  onVideoQualityChange: (value: string) => void
  onVideoFpsChange: (value: string) => void
  onScreenShareQualityChange: (value: string) => void
  onScreenShareFpsChange: (value: string) => void
  onHardwareAccelerationChange: (value: boolean) => void
}

const VolumeSlider: React.FC<{
  value: number
  onChange: (value: number) => void
  icon: React.ReactNode
  label: string
}> = ({ value, onChange, icon, label }) => {
  const percentage = (value / 100) * 100

  return (
    <div className="volume-control">
      <div className="volume-control__header">
        <div className="volume-control__icon">{icon}</div>
        <span className="volume-control__label">{label}</span>
        <span className="volume-control__value">{value}%</span>
      </div>
      <div className="volume-control__slider">
        <div className="volume-control__track">
          <div className="volume-control__fill" style={{ width: `${percentage}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="volume-control__input"
        />
      </div>
    </div>
  )
}

export const VoiceVideoSection: React.FC<VoiceVideoSectionProps> = ({
  audioDevices,
  selectedMicId,
  selectedSpeakerId,
  selectedCameraId,
  onMicChange,
  onSpeakerChange,
  onCameraChange,
  onRefreshDevices,
  inputVolume,
  outputVolume,
  onInputVolumeChange,
  onOutputVolumeChange,
  noiseSuppression,
  echoCancellation,
  autoGainControl,
  voiceActivityDetection,
  hardwareMute,
  autoAdjustMic,
  pushToTalk,
  onNoiseSuppressionChange,
  onEchoCancellationChange,
  onAutoGainControlChange,
  onVoiceActivityDetectionChange,
  onHardwareMuteChange,
  onAutoAdjustMicChange,
  onPushToTalkChange,
  videoQuality,
  videoFps,
  screenShareQuality,
  screenShareFps,
  hardwareAcceleration,
  onVideoQualityChange,
  onVideoFpsChange,
  onScreenShareQualityChange,
  onScreenShareFpsChange,
  onHardwareAccelerationChange,
}) => {
  const { t } = useTranslation("settings")
  const [isMicTesting, setIsMicTesting] = useState(false)
  const [isSpeakerTesting, setIsSpeakerTesting] = useState(false)
  const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null)
  const cameraPreviewRef = useRef<HTMLVideoElement>(null)

  const micDevices = audioDevices.filter((d) => d.kind === "audioinput")
  const speakerDevices = audioDevices.filter((d) => d.kind === "audiooutput")
  const cameraDevices = audioDevices.filter((d) => d.kind === "videoinput")

  const handleMicTest = useCallback(() => {
    setIsMicTesting((prev) => !prev)
  }, [])

  const handleSpeakerTest = useCallback(() => {
    if (isSpeakerTesting) {
      setIsSpeakerTesting(false)
      return
    }
    setIsSpeakerTesting(true)
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.frequency.value = 440
    gainNode.gain.value = 0.3
    oscillator.start()
    setTimeout(() => {
      oscillator.stop()
      setIsSpeakerTesting(false)
    }, 1000)
  }, [isSpeakerTesting])

  const startCameraPreview = useCallback(async () => {
    try {
      if (cameraPreviewStream) {
        cameraPreviewStream.getTracks().forEach((track) => track.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      setCameraPreviewStream(stream)
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream
      }
    } catch (err) {
      console.error("Failed to start camera preview:", err)
    }
  }, [selectedCameraId, cameraPreviewStream])

  const stopCameraPreview = useCallback(() => {
    if (cameraPreviewStream) {
      cameraPreviewStream.getTracks().forEach((track) => track.stop())
      setCameraPreviewStream(null)
    }
    if (cameraPreviewRef.current) {
      cameraPreviewRef.current.srcObject = null
    }
  }, [cameraPreviewStream])

  useEffect(() => {
    return () => {
      stopCameraPreview()
    }
  }, [stopCameraPreview])

  return (
    <div className="settings-section voice-video-section">
      {/* Audio Input Section */}
      <div className="vv-section">
        <div className="vv-section__header">
          <Mic size={20} className="vv-section__icon" />
          <div className="vv-section__title-group">
            <h3>{t("input_settings")}</h3>
            <p>{t("input_settings_desc")}</p>
          </div>
          <button className="vv-refresh-btn" onClick={onRefreshDevices} title={t("refresh_devices") || "Refresh"}>
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="vv-section__content">
          <div className="vv-device-row">
            <label className="vv-label">{t("input_device")}</label>
            <select 
              className="vv-select" 
              value={selectedMicId} 
              onChange={(e) => onMicChange(e.target.value)}  // Используем prop напрямую
            >
              {micDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <VolumeSlider
            value={inputVolume}
            onChange={onInputVolumeChange}
            icon={<Mic size={16} />}
            label={t("input_volume")}
          />

          <div className="vv-test-row">
            <Button theme={isMicTesting ? "danger" : "outline"} onClick={handleMicTest} className="vv-test-btn">
              {isMicTesting ? <Square size={14} /> : <Play size={14} />}
              {isMicTesting ? t("stop_test") : t("start_test")}
            </Button>
            {isMicTesting && (
              <div className="vv-level-indicator">
                <AudioLevelIndicator deviceId={selectedMicId} type="input" isActive={isMicTesting} barCount={20} />
              </div>
            )}
          </div>

          <div className="vv-options">
            <CheckboxField
              label={t("auto_adjust_mic")}
              checked={autoAdjustMic}
              onChange={(e) => onAutoAdjustMicChange(e.target.checked)}
            />
            <CheckboxField
              label={t("push_to_talk")}
              checked={pushToTalk}
              onChange={(e) => onPushToTalkChange(e.target.checked)}
            />
          </div>
        </div>
      </div>

      {/* Audio Output Section */}
      <div className="vv-section">
        <div className="vv-section__header">
          <Headphones size={20} className="vv-section__icon" />
          <div className="vv-section__title-group">
            <h3>{t("output_settings")}</h3>
            <p>{t("output_settings_desc")}</p>
          </div>
        </div>

        <div className="vv-section__content">
          <div className="vv-device-row">
            <label className="vv-label">{t("output_device")}</label>
            <select 
              className="vv-select" 
              value={selectedSpeakerId} 
              onChange={(e) => onSpeakerChange(e.target.value)}
            >
              {speakerDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <VolumeSlider
            value={outputVolume}
            onChange={onOutputVolumeChange}
            icon={<Volume2 size={16} />}
            label={t("output_volume")}
          />

          <div className="vv-test-row">
            <Button theme={isSpeakerTesting ? "danger" : "outline"} onClick={handleSpeakerTest} className="vv-test-btn">
              {isSpeakerTesting ? <Square size={14} /> : <Play size={14} />}
              {isSpeakerTesting ? t("stop_test") : t("start_test")}
            </Button>
          </div>
        </div>
      </div>

      {/* Video Section */}
      <div className="vv-section">
        <div className="vv-section__header">
          <Camera size={20} className="vv-section__icon" />
          <div className="vv-section__title-group">
            <h3>{t("video_settings")}</h3>
            <p>{t("video_settings_desc")}</p>
          </div>
        </div>

        <div className="vv-section__content">
          <div className="vv-video-grid">
            <div className="vv-video-preview">
              {cameraPreviewStream ? (
                <video ref={cameraPreviewRef} autoPlay playsInline muted className="vv-video-preview__stream" />
              ) : (
                <div className="vv-video-preview__placeholder">
                  <Video size={40} />
                  <span>{t("camera_off") || "Camera Off"}</span>
                </div>
              )}
              <div className="vv-video-preview__controls">
                <Button
                  theme={cameraPreviewStream ? "danger" : "primary"}
                  onClick={() => (cameraPreviewStream ? stopCameraPreview() : startCameraPreview())}
                >
                  <Camera size={14} />
                  {cameraPreviewStream ? t("stop_preview") || "Stop" : t("start_preview") || "Preview"}
                </Button>
              </div>
            </div>

            <div className="vv-video-settings">
              <div className="vv-device-row">
                <label className="vv-label">{t("camera_device")}</label>
                <select 
                  className="vv-select" 
                  value={selectedCameraId} 
                  onChange={(e) => onCameraChange(e.target.value)}
                >
                  {cameraDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vv-quality-row">
                <span className="vv-label">{t("video_quality")}</span>
                <div className="vv-pills">
                  {["4k", "1080p", "720p", "480p"].map((quality) => (
                    <button
                      key={quality}
                      className={cn("vv-pill", { "vv-pill--active": videoQuality === quality })}
                      onClick={() => onVideoQualityChange(quality)}
                    >
                      {quality === "4k" ? "4K" : quality}
                      {videoQuality === quality && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="vv-quality-row">
                <span className="vv-label">{t("video_fps")}</span>
                <div className="vv-pills">
                  {["60", "30"].map((fps) => (
                    <button
                      key={fps}
                      className={cn("vv-pill", { "vv-pill--active": videoFps === fps })}
                      onClick={() => onVideoFpsChange(fps)}
                    >
                      {fps} FPS
                      {videoFps === fps && <Check size={12} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Screen Share Section */}
      <div className="vv-section">
        <div className="vv-section__header">
          <Monitor size={20} className="vv-section__icon" />
          <div className="vv-section__title-group">
            <h3>{t("screen_share_settings")}</h3>
            <p>{t("screen_share_settings_desc")}</p>
          </div>
        </div>

        <div className="vv-section__content">
          <div className="vv-quality-row">
            <span className="vv-label">{t("screen_share_quality")}</span>
            <div className="vv-pills">
              {["4k", "1080p", "720p"].map((quality) => (
                <button
                  key={quality}
                  className={cn("vv-pill", { "vv-pill--active": screenShareQuality === quality })}
                  onClick={() => onScreenShareQualityChange(quality)}
                >
                  {quality === "4k" ? "4K" : quality}
                  {screenShareQuality === quality && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>

          <div className="vv-quality-row">
            <span className="vv-label">{t("screen_share_fps")}</span>
            <div className="vv-pills">
              {["60", "30"].map((fps) => (
                <button
                  key={fps}
                  className={cn("vv-pill", { "vv-pill--active": screenShareFps === fps })}
                  onClick={() => onScreenShareFpsChange(fps)}
                >
                  {fps} FPS
                  {screenShareFps === fps && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>

          <div className="vv-options">
            <CheckboxField
              label={t("hardware_acceleration")}
              checked={hardwareAcceleration}
              onChange={(e) => onHardwareAccelerationChange(e.target.checked)}
            />
          </div>
        </div>
      </div>

      {/* Voice Processing */}
      <div className="vv-section">
        <div className="vv-section__header">
          <Zap size={20} className="vv-section__icon vv-section__icon--accent" />
          <div className="vv-section__title-group">
            <h3>{t("voice_processing")}</h3>
            <p>{t("voice_processing_desc")}</p>
          </div>
        </div>

        <div className="vv-section__content">
          <div className="vv-options vv-options--grid">
            <CheckboxField
              label={t("noise_suppression")}
              checked={noiseSuppression}
              onChange={(e) => onNoiseSuppressionChange(e.target.checked)}
            />
            <CheckboxField
              label={t("echo_cancellation")}
              checked={echoCancellation}
              onChange={(e) => onEchoCancellationChange(e.target.checked)}
            />
            <CheckboxField
              label={t("auto_gain_control")}
              checked={autoGainControl}
              onChange={(e) => onAutoGainControlChange(e.target.checked)}
            />
            <CheckboxField
              label={t("voice_activity_detection")}
              checked={voiceActivityDetection}
              onChange={(e) => onVoiceActivityDetectionChange(e.target.checked)}
            />
            <CheckboxField
              label={t("hardware_mute")}
              checked={hardwareMute}
              onChange={(e) => onHardwareMuteChange(e.target.checked)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
