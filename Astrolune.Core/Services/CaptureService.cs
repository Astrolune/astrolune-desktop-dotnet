using Astrolune.Core.Models;

namespace Astrolune.Core.Services;

public sealed class CaptureService(IEventDispatcher dispatcher)
{
    private readonly IEventDispatcher _dispatcher = dispatcher;
    private readonly CaptureSourceProvider _sourceProvider = new();
    private readonly AudioDeviceProvider _audioProvider = new();
    private readonly SemaphoreSlim _screenLock = new(1, 1);
    private readonly SemaphoreSlim _audioLock = new(1, 1);
    private ScreenCaptureSession? _screenSession;
    private AudioCaptureSession? _audioSession;

    /// <summary>
    /// Returns the list of capture sources (monitors and windows).
    /// </summary>
    public Task<IReadOnlyList<CaptureSource>> GetCaptureSourcesAsync()
    {
        return Task.FromResult(_sourceProvider.ListSources());
    }

    /// <summary>
    /// Starts screen capture and returns the created session id.
    /// </summary>
    public async Task<string> StartScreenCaptureAsync(ScreenCaptureRequest request, CancellationToken cancellationToken = default)
    {
        await _screenLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_screenSession is not null)
            {
                await _screenSession.StopAsync().ConfigureAwait(false);
                await _screenSession.DisposeAsync().ConfigureAwait(false);
                _screenSession = null;
            }

            var sources = _sourceProvider.ListSources();
            if (sources.Count == 0)
            {
                throw new InvalidOperationException("No capture sources are available.");
            }

            var selected = ResolveSource(sources, request.SourceId);
            var fps = request.Fps ?? CaptureConstraints.MaxFps;
            var cursor = request.Cursor ?? true;
            _screenSession = ScreenCaptureSession.Start(_dispatcher, selected, fps, cursor);
            return _screenSession.SessionId;
        }
        finally
        {
            _screenLock.Release();
        }
    }

    /// <summary>
    /// Stops the active screen capture session.
    /// </summary>
    public async Task StopScreenCaptureAsync(CancellationToken cancellationToken = default)
    {
        await _screenLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_screenSession is not null)
            {
                await _screenSession.StopAsync().ConfigureAwait(false);
                await _screenSession.DisposeAsync().ConfigureAwait(false);
                _screenSession = null;
            }
        }
        finally
        {
            _screenLock.Release();
        }
    }

    /// <summary>
    /// Starts microphone capture and returns the created session id.
    /// </summary>
    public async Task<string> StartAudioCaptureAsync(AudioCaptureRequest request, CancellationToken cancellationToken = default)
    {
        await _audioLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_audioSession is not null)
            {
                await _audioSession.StopAsync().ConfigureAwait(false);
                await _audioSession.DisposeAsync().ConfigureAwait(false);
                _audioSession = null;
            }

            var device = _audioProvider.ResolveInputDevice(request.DeviceId);
            _audioSession = AudioCaptureSession.Start(_dispatcher, device, request);
            return _audioSession.SessionId;
        }
        finally
        {
            _audioLock.Release();
        }
    }

    /// <summary>
    /// Stops the active microphone capture session.
    /// </summary>
    public async Task StopAudioCaptureAsync(CancellationToken cancellationToken = default)
    {
        await _audioLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_audioSession is not null)
            {
                await _audioSession.StopAsync().ConfigureAwait(false);
                await _audioSession.DisposeAsync().ConfigureAwait(false);
                _audioSession = null;
            }
        }
        finally
        {
            _audioLock.Release();
        }
    }

    /// <summary>
    /// Lists all audio devices for capture UI.
    /// </summary>
    public Task<IReadOnlyList<AudioDevice>> GetAudioDevicesAsync()
    {
        return Task.FromResult(_audioProvider.ListAllDevices());
    }

    /// <summary>
    /// Returns the latest screen capture performance stats.
    /// </summary>
    public Task<CaptureStats> GetCaptureStatsAsync()
    {
        if (_screenSession is null)
        {
            throw new InvalidOperationException("No screen capture session is active.");
        }

        return Task.FromResult(_screenSession.GetStats());
    }

    private static CaptureSource ResolveSource(IReadOnlyList<CaptureSource> sources, string? sourceId)
    {
        if (!string.IsNullOrWhiteSpace(sourceId))
        {
            var match = sources.FirstOrDefault(source => source.Id == sourceId);
            if (match is not null)
            {
                return match;
            }

            throw new InvalidOperationException($"Capture source '{sourceId}' is not available.");
        }

        var ordered = sources
            .OrderBy(source => source.Kind == "monitor" && source.IsPrimary ? 0 : source.Kind == "monitor" ? 1 : 2)
            .ThenBy(source => source.Name)
            .ToList();

        return ordered[0];
    }
}
