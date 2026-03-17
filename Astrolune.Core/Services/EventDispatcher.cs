namespace Astrolune.Core.Services;

/// <summary>
/// Default implementation of IEventDispatcher.
/// </summary>
public sealed class EventDispatcher : IEventDispatcher, IEventDispatcherHost
{
    private Func<string, object, CancellationToken, Task>? _sink;

    /// <summary>
    /// Attaches a sink that forwards events to the host WebView.
    /// </summary>
    public void AttachSink(Func<string, object, CancellationToken, Task> sink)
    {
        _sink = sink;
    }

    /// <inheritdoc />
    public Task EmitAsync(string eventName, object payload, CancellationToken cancellationToken = default)
    {
        return _sink is null
            ? Task.CompletedTask
            : _sink(eventName, payload, cancellationToken);
    }
}
