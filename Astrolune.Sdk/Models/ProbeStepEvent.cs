namespace Astrolune.Sdk.Models;

/// <summary>
/// Media probe step event.
/// </summary>
public sealed record ProbeStepEvent
{
    [JsonPropertyName("label")]
    public required string Label { get; init; }
    
    [JsonPropertyName("ok")]
    public required bool Ok { get; init; }
    
    [JsonPropertyName("message")]
    public required string Message { get; init; }
}
