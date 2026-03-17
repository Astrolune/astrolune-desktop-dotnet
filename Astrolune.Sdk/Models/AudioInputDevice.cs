namespace Astrolune.Sdk.Models;

/// <summary>
/// Audio input device.
/// </summary>
public sealed record AudioInputDevice
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    
    [JsonPropertyName("name")]
    public required string Name { get; init; }
    
    [JsonPropertyName("isDefault")]
    public required bool IsDefault { get; init; }
}
