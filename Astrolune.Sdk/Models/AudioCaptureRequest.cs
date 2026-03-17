namespace Astrolune.Sdk.Models;

/// <summary>
/// Audio capture request.
/// </summary>
public sealed record AudioCaptureRequest
{
    [JsonPropertyName("deviceId")]
    public string? DeviceId { get; init; }
    
    [JsonPropertyName("sampleRate")]
    public uint? SampleRate { get; init; }
    
    [JsonPropertyName("channels")]
    public uint? Channels { get; init; }
    
    [JsonPropertyName("noiseGateThreshold")]
    public short? NoiseGateThreshold { get; init; }
    
    [JsonPropertyName("chunkMs")]
    public uint? ChunkMs { get; init; }
}
