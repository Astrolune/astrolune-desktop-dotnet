namespace Astrolune.Sdk.Models;

/// <summary>
/// Media devices snapshot.
/// </summary>
public sealed record MediaDevicesSnapshot
{
    [JsonPropertyName("audioInputs")]
    public required IReadOnlyList<MediaDevice> AudioInputs { get; init; }
    
    [JsonPropertyName("audioOutputs")]
    public required IReadOnlyList<MediaDevice> AudioOutputs { get; init; }
    
    [JsonPropertyName("videoInputs")]
    public required IReadOnlyList<MediaDevice> VideoInputs { get; init; }
}
