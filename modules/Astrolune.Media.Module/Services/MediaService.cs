namespace Astrolune.Media.Module.Services;

/// <summary>
/// Implementation of IMediaService for LiveKit integration.
/// </summary>
public sealed class MediaService : IMediaService
{
    private readonly AudioDeviceProvider _audioProvider = new();
    private readonly VideoDeviceProvider _videoProvider = new();
    private readonly LivekitPublisher _publisher = new();
    private readonly SemaphoreSlim _capabilitiesLock = new(1, 1);
    private MediaCapabilities _capabilities = new();

    /// <inheritdoc />
    public async Task<MediaCapabilities> GetCapabilitiesAsync(CancellationToken cancellationToken = default)
    {
        await _capabilitiesLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return _capabilities;
        }
        finally
        {
            _capabilitiesLock.Release();
        }
    }

    /// <inheritdoc />
    public async Task SetCapabilitiesAsync(MediaCapabilities capabilities, CancellationToken cancellationToken = default)
    {
        await _capabilitiesLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _capabilities = capabilities;
        }
        finally
        {
            _capabilitiesLock.Release();
        }
    }

    /// <inheritdoc />
    public Task ConnectLivekitAsync(ConnectLivekitRequest request, CancellationToken cancellationToken = default)
    {
        _publisher.Connect(request.LivekitUrl, request.Token);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task DisconnectLivekitAsync(CancellationToken cancellationToken = default)
    {
        _publisher.Disconnect();
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StartVoiceAsync(StartVoiceRequest request, CancellationToken cancellationToken = default)
    {
        _publisher.StartMicrophone(request.InputDeviceId);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StartCameraAsync(StartCameraRequest request, CancellationToken cancellationToken = default)
    {
        _publisher.StartCamera(request.DeviceId);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public async Task StartScreenShareAsync(StartScreenShareRequest request, CancellationToken cancellationToken = default)
    {
        var capabilities = await GetCapabilitiesAsync(cancellationToken).ConfigureAwait(false);
        if (!capabilities.DxgiAvailable)
        {
            throw new InvalidOperationException(
                capabilities.DxgiError ?? "Screen sharing is not supported on this device.");
        }

        _publisher.StartScreenShare(request.SourceId);
    }

    /// <inheritdoc />
    public Task StopMediaAsync(CancellationToken cancellationToken = default)
    {
        _publisher.Disconnect();
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopVoiceAsync(CancellationToken cancellationToken = default)
    {
        _publisher.StopMicrophone();
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopCameraAsync(CancellationToken cancellationToken = default)
    {
        _publisher.StopCamera();
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopScreenShareAsync(CancellationToken cancellationToken = default)
    {
        _publisher.StopScreenShare();
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<AudioInputDevice>> ListAudioInputDevicesAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult(_audioProvider.ListInputDevices());
    }

    /// <inheritdoc />
    public async Task<MediaDevicesSnapshot> ListMediaDevicesAsync(CancellationToken cancellationToken = default)
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
