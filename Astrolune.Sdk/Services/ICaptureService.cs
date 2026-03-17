using Astrolune.Sdk.Models;

namespace Astrolune.Sdk.Services;

/// <summary>
/// Service for media capture (screen, audio, video).
/// </summary>
public interface ICaptureService
{
    /// <summary>
    /// Returns the list of capture sources (monitors and windows).
    /// </summary>
    Task<IReadOnlyList<CaptureSource>> GetCaptureSourcesAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Starts screen capture and returns the created session id.
    /// </summary>
    Task<string> StartScreenCaptureAsync(ScreenCaptureRequest request, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Stops the active screen capture session.
    /// </summary>
    Task StopScreenCaptureAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Starts microphone capture and returns the created session id.
    /// </summary>
    Task<string> StartAudioCaptureAsync(AudioCaptureRequest request, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Stops the active microphone capture session.
    /// </summary>
    Task StopAudioCaptureAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Lists all audio devices for capture UI.
    /// </summary>
    Task<IReadOnlyList<AudioDevice>> GetAudioDevicesAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Returns the latest screen capture performance stats.
    /// </summary>
    Task<CaptureStats> GetCaptureStatsAsync(CancellationToken cancellationToken = default);
}
