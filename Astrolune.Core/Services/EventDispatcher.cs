namespace Astrolune.Core.Services;

public interface IEventDispatcher
{
    /// <summary>
    /// Emits an event to the frontend event bus.
    /// </summary>
    Task EmitAsync(string eventName, object payload, CancellationToken cancellationToken = default);
}

public sealed class EventDispatcher : IEventDispatcher
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
