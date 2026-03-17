namespace Astrolune.Sdk.Models;

/// <summary>
/// Start screen share request.
/// </summary>
public sealed record StartScreenShareRequest
{
    [JsonPropertyName("sourceId")]
    public string? SourceId { get; init; }
    
    [JsonPropertyName("resolution")]
    public uint[]? Resolution { get; init; }
    
    [JsonPropertyName("cursor")]
    public bool? Cursor { get; init; }
    
    [JsonPropertyName("fps")]
    public uint? Fps { get; init; }
    
    [JsonPropertyName("bitrateKbps")]
    public uint? BitrateKbps { get; init; }
}
