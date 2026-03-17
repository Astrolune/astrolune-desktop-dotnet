using Astrolune.Sdk.Models;

namespace Astrolune.Sdk.Services;

/// <summary>
/// Service for media capabilities and LiveKit integration.
/// </summary>
public interface IMediaService
{
    /// <summary>
    /// Returns the latest cached media capabilities.
    /// </summary>
    Task<MediaCapabilities> GetCapabilitiesAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Updates the media capability snapshot.
    /// </summary>
    Task SetCapabilitiesAsync(MediaCapabilities capabilities, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Connects to LiveKit using the provided URL and token.
    /// </summary>
    Task ConnectLivekitAsync(ConnectLivekitRequest request, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Disconnects from the current LiveKit session and stops all media tracks.
    /// </summary>
    Task DisconnectLivekitAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Starts microphone publishing against the active LiveKit session.
    /// </summary>
    Task StartVoiceAsync(StartVoiceRequest request, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Starts camera publishing against the active LiveKit session.
    /// </summary>
    Task StartCameraAsync(StartCameraRequest request, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Starts screen sharing against the active LiveKit session.
    /// </summary>
    Task StartScreenShareAsync(StartScreenShareRequest request, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Stops all active LiveKit media tracks and disconnects.
    /// </summary>
    Task StopMediaAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Stops microphone publishing.
    /// </summary>
    Task StopVoiceAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Stops camera publishing.
    /// </summary>
    Task StopCameraAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Stops screen sharing.
    /// </summary>
    Task StopScreenShareAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Lists audio input devices.
    /// </summary>
    Task<IReadOnlyList<AudioInputDevice>> ListAudioInputDevicesAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Lists all audio/video devices used by the media UI.
    /// </summary>
    Task<MediaDevicesSnapshot> ListMediaDevicesAsync(CancellationToken cancellationToken = default);
}
