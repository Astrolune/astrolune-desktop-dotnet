using Astrolune.Core.Models;

namespace Astrolune.Core.Services;

public sealed class MediaService
{
    private readonly AudioDeviceProvider _audioProvider = new();
    private readonly VideoDeviceProvider _videoProvider = new();
    private readonly LivekitPublisher _publisher = new();
    private readonly SemaphoreSlim _capabilitiesLock = new(1, 1);
    private MediaCapabilities _capabilities = new();

    /// <summary>
    /// Returns the latest cached media capabilities.
    /// </summary>
    public async Task<MediaCapabilities> GetCapabilitiesAsync()
    {
        await _capabilitiesLock.WaitAsync().ConfigureAwait(false);
        try
        {
            return _capabilities;
        }
        finally
        {
            _capabilitiesLock.Release();
        }
    }

    /// <summary>
    /// Updates the media capability snapshot.
    /// </summary>
    public async Task SetCapabilitiesAsync(MediaCapabilities capabilities)
    {
        await _capabilitiesLock.WaitAsync().ConfigureAwait(false);
        try
        {
            _capabilities = capabilities;
        }
        finally
        {
            _capabilitiesLock.Release();
        }
    }

    /// <summary>
    /// Connects to LiveKit using the provided URL and token.
    /// </summary>
    public Task ConnectLivekitAsync(ConnectLivekitRequest request)
    {
        _publisher.Connect(request.LivekitUrl, request.Token);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Disconnects from the current LiveKit session and stops all media tracks.
    /// </summary>
    public Task DisconnectLivekitAsync()
    {
        _publisher.Disconnect();
        return Task.CompletedTask;
    }

    /// <summary>
    /// Starts microphone publishing against the active LiveKit session.
    /// </summary>
    public Task StartVoiceAsync(StartVoiceRequest request)
    {
        _publisher.StartMicrophone(request.InputDeviceId);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Starts camera publishing against the active LiveKit session.
    /// </summary>
    public Task StartCameraAsync(StartCameraRequest request)
    {
        _publisher.StartCamera(request.DeviceId);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Starts screen sharing against the active LiveKit session.
    /// </summary>
    public async Task StartScreenShareAsync(StartScreenShareRequest request)
    {
        var capabilities = await GetCapabilitiesAsync().ConfigureAwait(false);
        if (!capabilities.DxgiAvailable)
        {
            throw new InvalidOperationException(
                capabilities.DxgiError ?? "Screen sharing is not supported on this device.");
        }

        _publisher.StartScreenShare(request.SourceId);
    }

    /// <summary>
    /// Stops all active LiveKit media tracks and disconnects.
    /// </summary>
    public Task StopMediaAsync()
    {
        _publisher.Disconnect();
        return Task.CompletedTask;
    }

    /// <summary>
    /// Stops microphone publishing.
    /// </summary>
    public Task StopVoiceAsync()
    {
        _publisher.StopMicrophone();
        return Task.CompletedTask;
    }

    /// <summary>
    /// Stops camera publishing.
    /// </summary>
    public Task StopCameraAsync()
    {
        _publisher.StopCamera();
        return Task.CompletedTask;
    }

    /// <summary>
    /// Stops screen sharing.
    /// </summary>
    public Task StopScreenShareAsync()
    {
        _publisher.StopScreenShare();
        return Task.CompletedTask;
    }

    /// <summary>
    /// Lists audio input devices.
    /// </summary>
    public Task<IReadOnlyList<AudioInputDevice>> ListAudioInputDevicesAsync()
    {
        return Task.FromResult(_audioProvider.ListInputDevices());
    }

    /// <summary>
    /// Lists all audio/video devices used by the media UI.
    /// </summary>
    public async Task<MediaDevicesSnapshot> ListMediaDevicesAsync()
    {
        var audioInputs = _audioProvider.ListInputDevices()
            .Select(device => new MediaDevice
            {
                Id = device.Id,
                Name = device.Name,
                Kind = "audioinput",
                IsDefault = device.IsDefault
            })
            .ToList();

        var audioOutputs = _audioProvider.ListAllDevices()
            .Where(device => device.Kind == "audiooutput")
            .Select(device => new MediaDevice
            {
                Id = device.Id,
                Name = device.Name,
                Kind = "audiooutput",
                IsDefault = device.IsDefault
            })
            .ToList();

        var videoInputs = await _videoProvider.ListVideoInputDevicesAsync().ConfigureAwait(false);

        return new MediaDevicesSnapshot
        {
            AudioInputs = audioInputs,
            AudioOutputs = audioOutputs,
            VideoInputs = videoInputs
        };
    }

    private sealed class LivekitPublisher
    {
        private bool _connected;
        private bool _microphoneActive;
        private bool _cameraActive;
        private bool _screenShareActive;

        public void Connect(string url, string token)
        {
            if (string.IsNullOrWhiteSpace(url))
            {
                throw new InvalidOperationException("LiveKit URL is required.");
            }

            if (string.IsNullOrWhiteSpace(token))
            {
                throw new InvalidOperationException("LiveKit token is required.");
            }

            _connected = true;
        }

        public void Disconnect()
        {
            _microphoneActive = false;
            _cameraActive = false;
            _screenShareActive = false;
            _connected = false;
        }

        public void StartMicrophone(string? deviceId)
        {
            EnsureConnected();
            _microphoneActive = true;
        }

        public void StopMicrophone()
        {
            _microphoneActive = false;
        }

        public void StartCamera(string? deviceId)
        {
            EnsureConnected();
            _cameraActive = true;
        }

        public void StopCamera()
        {
            _cameraActive = false;
        }

        public void StartScreenShare(string? sourceId)
        {
            EnsureConnected();
            _screenShareActive = true;
        }

        public void StopScreenShare()
        {
            _screenShareActive = false;
        }

        private void EnsureConnected()
        {
            if (!_connected)
            {
                throw new InvalidOperationException("LiveKit publisher is not connected.");
            }
        }
    }
}
