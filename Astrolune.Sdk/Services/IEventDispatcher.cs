namespace Astrolune.Sdk.Services;

/// <summary>
/// Event dispatcher for module-to-frontend communication.
/// </summary>
public interface IEventDispatcher
{
    /// <summary>
    /// Emits an event to the frontend event bus.
    /// </summary>
    Task EmitAsync(string eventName, object payload, CancellationToken cancellationToken = default);
}
