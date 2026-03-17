namespace Astrolune.Sdk.Models;

/// <summary>
/// Screen capture state.
/// </summary>
public sealed record ScreenCaptureState
{
    [JsonPropertyName("sessionId")]
    public required string SessionId { get; init; }
    
    [JsonPropertyName("status")]
    public required string Status { get; init; }
    
    [JsonPropertyName("message")]
    public string? Message { get; init; }
}
