namespace Astrolune.Sdk.Services;

/// <summary>
/// Host-only extension for wiring the event dispatcher to a frontend sink.
/// </summary>
public interface IEventDispatcherHost
{
    /// <summary>
    /// Attaches a sink that forwards events to the host frontend.
    /// </summary>
    void AttachSink(Func<string, object, CancellationToken, Task> sink);
}
