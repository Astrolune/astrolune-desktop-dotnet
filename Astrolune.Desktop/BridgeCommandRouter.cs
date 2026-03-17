using System.Text.Json;
using System.Windows;
using Astrolune.Sdk.Models;
using Astrolune.Sdk.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Astrolune.Desktop;

public sealed class BridgeCommandRouter
{
    private readonly ICaptureService _capture;
    private readonly IMediaService _media;
    private readonly IKeyringService _keyring;
    private readonly AuthClientLauncher _authClient;
    private readonly IServiceProvider _services;
    private readonly JsonSerializerOptions _jsonOptions;

    public BridgeCommandRouter(
        ICaptureService capture,
        IMediaService media,
        IKeyringService keyring,
        AuthClientLauncher authClient,
        IServiceProvider services)
    {
        _capture = capture;
        _media = media;
        _keyring = keyring;
        _authClient = authClient;
        _services = services;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
    }

    public async Task<object?> HandleAsync(string command, JsonElement? payload)
    {
        return command switch
        {
            "connect_livekit" => await HandleConnectLivekitAsync(payload).ConfigureAwait(false),
            "disconnect_livekit" => await HandleDisconnectLivekitAsync().ConfigureAwait(false),
            "start_voice" => await HandleStartVoiceAsync(payload).ConfigureAwait(false),
            "start_screen_share" => await HandleStartScreenShareAsync(payload).ConfigureAwait(false),
            "start_camera" => await HandleStartCameraAsync(payload).ConfigureAwait(false),
            "stop_media" => await HandleStopMediaAsync().ConfigureAwait(false),
            "stop_voice" => await HandleStopVoiceAsync().ConfigureAwait(false),
            "stop_screen_share" => await HandleStopScreenShareAsync().ConfigureAwait(false),
            "stop_camera" => await HandleStopCameraAsync().ConfigureAwait(false),
            "list_audio_input_devices" => await HandleListAudioInputDevicesAsync().ConfigureAwait(false),
            "list_media_devices" => await HandleListMediaDevicesAsync().ConfigureAwait(false),
            "list_capture_sources" => await HandleGetCaptureSourcesAsync().ConfigureAwait(false),
            "get_capture_sources" => await HandleGetCaptureSourcesAsync().ConfigureAwait(false),
            "start_screen_capture" => await HandleStartScreenCaptureAsync(payload).ConfigureAwait(false),
            "stop_screen_capture" => await HandleStopScreenCaptureAsync().ConfigureAwait(false),
            "get_capture_stats" => await HandleGetCaptureStatsAsync().ConfigureAwait(false),
            "start_audio_capture" => await HandleStartAudioCaptureAsync(payload).ConfigureAwait(false),
            "stop_audio_capture" => await HandleStopAudioCaptureAsync().ConfigureAwait(false),
            "get_audio_devices" => await HandleGetAudioDevicesAsync().ConfigureAwait(false),
            "get_livekit_capture_sources" => await HandleGetCaptureSourcesAsync().ConfigureAwait(false),
            "start_native_livekit_screen_share" => await HandleStartNativeLivekitScreenShareAsync(payload).ConfigureAwait(false),
            "stop_native_livekit_screen_share" => await HandleStopScreenCaptureAsync().ConfigureAwait(false),
            "open_auth_client" => HandleOpenAuthClient(payload),
            "keyring_get_password" => await HandleKeyringGetAsync(payload).ConfigureAwait(false),
            "keyring_set_password" => await HandleKeyringSetAsync(payload).ConfigureAwait(false),
            "keyring_delete_password" => await HandleKeyringDeleteAsync(payload).ConfigureAwait(false),
            "window_minimize" => HandleWindowMinimize(),
            "window_maximize" => HandleWindowMaximize(),
            "window_close" => HandleWindowClose(),
            "window_drag" => HandleWindowDrag(),
            _ => throw new InvalidOperationException($"Unknown command '{command}'.")
        };
    }

    private async Task<object?> HandleConnectLivekitAsync(JsonElement? payload)
    {
        var request = DeserializeRequest<ConnectLivekitRequest>(payload)
                      ?? throw new InvalidOperationException("Missing connect_livekit payload.");
        await _media.ConnectLivekitAsync(request).ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleDisconnectLivekitAsync()
    {
        await _media.DisconnectLivekitAsync().ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleStartVoiceAsync(JsonElement? payload)
    {
        var request = DeserializeRequest<StartVoiceRequest>(payload) ?? new StartVoiceRequest();
        await _media.StartVoiceAsync(request).ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleStartScreenShareAsync(JsonElement? payload)
    {
        var request = DeserializeRequest<StartScreenShareRequest>(payload) ?? new StartScreenShareRequest();
        await _media.StartScreenShareAsync(request).ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleStartCameraAsync(JsonElement? payload)
    {
        var request = DeserializeRequest<StartCameraRequest>(payload) ?? new StartCameraRequest();
        await _media.StartCameraAsync(request).ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleStopMediaAsync()
    {
        await _media.StopMediaAsync().ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleStopVoiceAsync()
    {
        await _media.StopVoiceAsync().ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleStopScreenShareAsync()
    {
        await _media.StopScreenShareAsync().ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleStopCameraAsync()
    {
        await _media.StopCameraAsync().ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleListAudioInputDevicesAsync()
    {
        return await _media.ListAudioInputDevicesAsync().ConfigureAwait(false);
    }

    private async Task<object?> HandleListMediaDevicesAsync()
    {
        return await _media.ListMediaDevicesAsync().ConfigureAwait(false);
    }

    private async Task<object?> HandleGetCaptureSourcesAsync()
    {
        return await _capture.GetCaptureSourcesAsync().ConfigureAwait(false);
    }

    private async Task<object?> HandleStartScreenCaptureAsync(JsonElement? payload)
    {
        var request = DeserializeRequest<ScreenCaptureRequest>(payload) ?? new ScreenCaptureRequest();
        var legacy = ParseLegacyScreenCaptureRequest(payload);
        request = request with
        {
            SourceId = request.SourceId ?? legacy.SourceId,
            Fps = request.Fps ?? legacy.Fps,
            Cursor = request.Cursor ?? legacy.Cursor
        };
        var sessionId = await _capture.StartScreenCaptureAsync(request).ConfigureAwait(false);
        return sessionId;
    }

    private async Task<object?> HandleStopScreenCaptureAsync()
    {
        await _capture.StopScreenCaptureAsync().ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleGetCaptureStatsAsync()
    {
        return await _capture.GetCaptureStatsAsync().ConfigureAwait(false);
    }

    private async Task<object?> HandleStartAudioCaptureAsync(JsonElement? payload)
    {
        var request = DeserializeRequest<AudioCaptureRequest>(payload) ?? new AudioCaptureRequest();
        var sessionId = await _capture.StartAudioCaptureAsync(request).ConfigureAwait(false);
        return sessionId;
    }

    private async Task<object?> HandleStopAudioCaptureAsync()
    {
        await _capture.StopAudioCaptureAsync().ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleGetAudioDevicesAsync()
    {
        return await _capture.GetAudioDevicesAsync().ConfigureAwait(false);
    }

    private async Task<object?> HandleStartNativeLivekitScreenShareAsync(JsonElement? payload)
    {
        var request = ParseNativeLivekitScreenShare(payload);
        var sessionId = await _capture.StartScreenCaptureAsync(request).ConfigureAwait(false);
        return sessionId;
    }

    private object? HandleOpenAuthClient(JsonElement? payload)
    {
        string? mode = null;
        if (payload is not null && payload.Value.ValueKind == JsonValueKind.Object)
        {
            mode = payload.Value.TryGetProperty("mode", out var modeElement)
                ? modeElement.GetString()
                : null;
        }

        _authClient.Open(mode);
        return null;
    }

    private async Task<object?> HandleKeyringGetAsync(JsonElement? payload)
    {
        var (service, key, _) = ParseKeyringPayload(payload);
        return await _keyring.GetPasswordAsync(service, key).ConfigureAwait(false);
    }

    private async Task<object?> HandleKeyringSetAsync(JsonElement? payload)
    {
        var (service, key, password) = ParseKeyringPayload(payload);
        if (password is null)
        {
            throw new InvalidOperationException("Missing password for keyring set.");
        }

        await _keyring.SetPasswordAsync(service, key, password).ConfigureAwait(false);
        return null;
    }

    private async Task<object?> HandleKeyringDeleteAsync(JsonElement? payload)
    {
        var (service, key, _) = ParseKeyringPayload(payload);
        await _keyring.DeletePasswordAsync(service, key).ConfigureAwait(false);
        return null;
    }

    private object? HandleWindowMinimize()
    {
        var window = ResolveWindow();
        window.Dispatcher.Invoke(() => window.WindowState = WindowState.Minimized);
        return null;
    }

    private object? HandleWindowMaximize()
    {
        var window = ResolveWindow();
        window.Dispatcher.Invoke(() =>
        {
            window.WindowState = window.WindowState == WindowState.Maximized
                ? WindowState.Normal
                : WindowState.Maximized;
        });
        return null;
    }

    private object? HandleWindowClose()
    {
        var window = ResolveWindow();
        window.Dispatcher.Invoke(() => window.Close());
        return null;
    }

    private object? HandleWindowDrag()
    {
        var window = ResolveWindow();
        window.Dispatcher.Invoke(() =>
        {
            try
            {
                window.DragMove();
            }
            catch
            {
                // DragMove can throw if the mouse isn't pressed.
            }
        });
        return null;
    }

    private T? DeserializeRequest<T>(JsonElement? payload)
    {
        if (payload is null)
        {
            return default;
        }

        if (payload.Value.ValueKind == JsonValueKind.Object &&
            payload.Value.TryGetProperty("request", out var requestElement))
        {
            return JsonSerializer.Deserialize<T>(requestElement, _jsonOptions);
        }

        return JsonSerializer.Deserialize<T>(payload.Value, _jsonOptions);
    }

    private static ScreenCaptureRequest ParseLegacyScreenCaptureRequest(JsonElement? payload)
    {
        if (payload is null || payload.Value.ValueKind != JsonValueKind.Object)
        {
            return new ScreenCaptureRequest();
        }

        var sourceId = payload.Value.TryGetProperty("sourceId", out var sourceElement)
            ? sourceElement.GetString()
            : null;

        uint? fps = null;
        bool? cursor = null;

        if (payload.Value.TryGetProperty("options", out var optionsElement) &&
            optionsElement.ValueKind == JsonValueKind.Object)
        {
            if (optionsElement.TryGetProperty("fps", out var fpsElement) &&
                fpsElement.ValueKind == JsonValueKind.Number)
            {
                fps = fpsElement.GetUInt32();
            }

            if (optionsElement.TryGetProperty("cursor", out var cursorElement) &&
                cursorElement.ValueKind is JsonValueKind.True or JsonValueKind.False)
            {
                cursor = cursorElement.GetBoolean();
            }
        }

        return new ScreenCaptureRequest
        {
            SourceId = sourceId,
            Fps = fps,
            Cursor = cursor
        };
    }

    private static ScreenCaptureRequest ParseNativeLivekitScreenShare(JsonElement? payload)
    {
        if (payload is null || payload.Value.ValueKind != JsonValueKind.Object)
        {
            return new ScreenCaptureRequest();
        }

        var sourceId = payload.Value.TryGetProperty("sourceId", out var sourceElement)
            ? sourceElement.GetString()
            : null;

        uint? fps = null;
        bool? cursor = null;

        if (payload.Value.TryGetProperty("options", out var optionsElement) &&
            optionsElement.ValueKind == JsonValueKind.Object)
        {
            if (optionsElement.TryGetProperty("fps", out var fpsElement) &&
                fpsElement.ValueKind == JsonValueKind.Number)
            {
                fps = fpsElement.GetUInt32();
            }

            if (optionsElement.TryGetProperty("cursor", out var cursorElement) &&
                cursorElement.ValueKind is JsonValueKind.True or JsonValueKind.False)
            {
                cursor = cursorElement.GetBoolean();
            }
        }

        return new ScreenCaptureRequest
        {
            SourceId = sourceId,
            Fps = fps,
            Cursor = cursor
        };
    }

    private static (string service, string key, string? password) ParseKeyringPayload(JsonElement? payload)
    {
        if (payload is null || payload.Value.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException("Invalid keyring payload.");
        }

        var service = payload.Value.TryGetProperty("service", out var serviceElement)
            ? serviceElement.GetString()
            : null;
        var key = payload.Value.TryGetProperty("key", out var keyElement)
            ? keyElement.GetString()
            : null;
        var password = payload.Value.TryGetProperty("password", out var passwordElement)
            ? passwordElement.GetString()
            : null;

        if (string.IsNullOrWhiteSpace(service) || string.IsNullOrWhiteSpace(key))
        {
            throw new InvalidOperationException("Keyring payload is missing required fields.");
        }

        return (service, key, password);
    }

    private Window ResolveWindow()
    {
        return _services.GetRequiredService<MainWindow>();
    }
}
