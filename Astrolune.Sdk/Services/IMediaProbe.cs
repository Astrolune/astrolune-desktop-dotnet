namespace Astrolune.Sdk.Services;

/// <summary>
/// Service for probing media capabilities.
/// </summary>
public interface IMediaProbe
{
    /// <summary>
    /// Runs startup probes and emits capability events.
    /// </summary>
    Task RunAsync(CancellationToken cancellationToken = default);
}
