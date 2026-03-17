namespace Astrolune.Sdk.Models;

/// <summary>
/// Audio capture state.
/// </summary>
public sealed record AudioCaptureState
{
    [JsonPropertyName("sessionId")]
    public required string SessionId { get; init; }
    
    [JsonPropertyName("status")]
    public required string Status { get; init; }
    
    [JsonPropertyName("message")]
    public string? Message { get; init; }
}
