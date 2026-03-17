namespace Astrolune.Sdk.Models;

/// <summary>
/// Media device.
/// </summary>
public sealed record MediaDevice
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    
    [JsonPropertyName("name")]
    public required string Name { get; init; }
    
    [JsonPropertyName("kind")]
    public required string Kind { get; init; }
    
    [JsonPropertyName("isDefault")]
    public required bool IsDefault { get; init; }
}
