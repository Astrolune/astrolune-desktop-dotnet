using System.Collections.Concurrent;
using Astrolune.Core.Services;

namespace Astrolune.Desktop;

public sealed record AuthCallbackPayload
{
    public string? AccessToken { get; init; }
    public string? RefreshToken { get; init; }
    public string? Error { get; init; }
}

public sealed class AuthCallbackManager
{
    private readonly ConcurrentQueue<AuthCallbackPayload> _pending = new();

    public void Enqueue(AuthCallbackPayload payload)
    {
        _pending.Enqueue(payload);
    }

    public async Task FlushAsync(IEventDispatcher dispatcher, CancellationToken cancellationToken = default)
    {
        while (_pending.TryDequeue(out var payload))
        {
            await dispatcher.EmitAsync("auth://callback", payload, cancellationToken).ConfigureAwait(false);
        }
    }
}
