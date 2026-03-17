namespace Astrolune.Sdk.Models;

/// <summary>
/// Screen capture request.
/// </summary>
public sealed record ScreenCaptureRequest
{
    [JsonPropertyName("sourceId")]
    public string? SourceId { get; init; }
    
    [JsonPropertyName("fps")]
    public uint? Fps { get; init; }
    
    [JsonPropertyName("cursor")]
    public bool? Cursor { get; init; }
}
