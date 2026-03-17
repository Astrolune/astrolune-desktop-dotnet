namespace Astrolune.Sdk.Models;

/// <summary>
/// Audio capture frame.
/// </summary>
public sealed record AudioCaptureFrame
{
    [JsonPropertyName("sessionId")]
    public required string SessionId { get; init; }
    
    [JsonPropertyName("sampleRate")]
    public required uint SampleRate { get; init; }
    
    [JsonPropertyName("channels")]
    public required uint Channels { get; init; }
    
    [JsonPropertyName("samplesPerChannel")]
    public required uint SamplesPerChannel { get; init; }
    
    [JsonPropertyName("timestampMs")]
    public required ulong TimestampMs { get; init; }
    
    [JsonPropertyName("format")]
    public required string Format { get; init; }
    
    [JsonPropertyName("dataBase64")]
    public required string DataBase64 { get; init; }
}
