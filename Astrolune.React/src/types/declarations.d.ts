export interface StoreSchema {
  [key: string]: unknown
  language: string
  accessToken: string | null
  refreshToken: string | null
  authToken: string | null
  sessions: unknown | null
  privacy: {
    allowDMs: boolean
    allowFriendRequests: boolean
    showOnlineStatus: boolean
    showActivity: boolean
    allowServerInvites: boolean
    messageScanning: boolean
    dataCollection: boolean
  }
  notifications: {
    desktop: boolean
    sound: boolean
    messages: boolean
    mentions: boolean
    friends: boolean
    flashTaskbar: boolean
  }
  voice: {
    inputVolume: number
    outputVolume: number
    noiseSuppression: boolean
    echoCancellation: boolean
    autoGainControl: boolean
    pushToTalk: boolean
    voiceActivityDetection: boolean
    autoAdjustMic: boolean
    hardwareMute: boolean
    hardwareAcceleration: boolean
    videoQuality: string
    videoFps: string
    screenShareQuality: string
    screenShareFps: string
    selectedMicId: string
    selectedSpeakerId: string
    selectedCameraId: string
  }
  account: {
    twoFactorEnabled: boolean
    backupCodesEnabled: boolean
  }
}

export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
  display_id: string
  appIcon: string | null
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}
