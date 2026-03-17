namespace Astrolune.Sdk.Models;

/// <summary>
/// Start camera request.
/// </summary>
public sealed record StartCameraRequest
{
    [JsonPropertyName("deviceId")]
    public string? DeviceId { get; init; }
    
    [JsonPropertyName("resolution")]
    public uint[]? Resolution { get; init; }
    
    [JsonPropertyName("fps")]
    public uint? Fps { get; init; }
}
