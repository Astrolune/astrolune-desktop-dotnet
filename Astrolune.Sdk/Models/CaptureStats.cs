namespace Astrolune.Sdk.Models;

/// <summary>
/// Capture statistics.
/// </summary>
public sealed record CaptureStats
{
    [JsonPropertyName("fps_actual")]
    public required double FpsActual { get; init; }
    
    [JsonPropertyName("resolution")]
    public required uint[] Resolution { get; init; }
    
    [JsonPropertyName("bitrate_kbps")]
    public required uint BitrateKbps { get; init; }
    
    [JsonPropertyName("dropped_frames")]
    public required uint DroppedFrames { get; init; }
    
    [JsonPropertyName("encoder")]
    public required string Encoder { get; init; }
}
