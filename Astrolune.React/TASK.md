# Astrolune Desktop - Project Tasks

Repos:
- Desktop: https://github.com/Astrolune/astrolune-desktop
- Backend: https://github.com/Astrolune/astrolune-backend

Status legend:
- DONE: Implemented and working
- IN PROGRESS: Partially implemented or awaiting wiring
- TODO: Planned / not started

## Current Status
| Area | Status | Notes |
| --- | --- | --- |
| LiveKit Rust publishing (mic/cam/screen) | DONE | windows-capture + cpal + LiveKit Rust SDK |
| LiveKit JS subscribe pipeline | DONE | React context with Room/participants |
| LiveKit REST client (tokens/rooms/participants) | DONE | Typed TS client added |
| LiveKit realtime WS events | DONE | Typed WS client added |
| Screen capture frame events to TS | DONE | Tauri events at 60fps target |
| Audio capture frame events to TS | DONE | cpal capture + noise gate |
| LiveKit Components React UI | TODO | Dependency added, wiring pending |
| 4K/60 default publish presets | IN PROGRESS | Encoding presets added, tuning pending |

## Active Work
- LiveKit 4K/60 quality tuning and UI presets
- Realtime event wiring into UI state

## Next Steps
- Wire LiveKit Components React for production call UI
- Add diagnostics panel for capture and publish pipeline
- Add backend moderation/reliability events
