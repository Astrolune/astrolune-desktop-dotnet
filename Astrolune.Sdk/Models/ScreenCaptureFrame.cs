namespace Astrolune.Sdk.Models;

/// <summary>
/// Screen capture frame.
/// </summary>
public sealed record ScreenCaptureFrame
{
    [JsonPropertyName("sessionId")]
    public required string SessionId { get; init; }
    
    [JsonPropertyName("width")]
    public required uint Width { get; init; }
    
    [JsonPropertyName("height")]
    public required uint Height { get; init; }
    
    [JsonPropertyName("stride")]
    public required uint Stride { get; init; }
    
    [JsonPropertyName("timestampUs")]
    public required ulong TimestampUs { get; init; }
    
    [JsonPropertyName("format")]
    public required string Format { get; init; }
    
    [JsonPropertyName("dataBase64")]
    public required string DataBase64 { get; init; }
}
