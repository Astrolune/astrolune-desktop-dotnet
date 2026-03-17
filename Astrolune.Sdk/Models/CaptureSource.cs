namespace Astrolune.Sdk.Models;

/// <summary>
/// Capture source (monitor or window).
/// </summary>
public sealed record CaptureSource
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    
    [JsonPropertyName("kind")]
    public required string Kind { get; init; }
    
    [JsonPropertyName("name")]
    public required string Name { get; init; }
    
    [JsonPropertyName("thumbnail")]
    public required string Thumbnail { get; init; }
    
    [JsonPropertyName("width")]
    public required uint Width { get; init; }
    
    [JsonPropertyName("height")]
    public required uint Height { get; init; }
    
    [JsonPropertyName("isPrimary")]
    public required bool IsPrimary { get; init; }
}
