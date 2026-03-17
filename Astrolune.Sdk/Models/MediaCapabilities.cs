namespace Astrolune.Sdk.Models;

/// <summary>
/// Media capabilities.
/// </summary>
public sealed record MediaCapabilities
{
    [JsonPropertyName("nvencAvailable")]
    public bool NvencAvailable { get; init; }
    
    [JsonPropertyName("nvencError")]
    public string? NvencError { get; init; }
    
    [JsonPropertyName("dxgiAvailable")]
    public bool DxgiAvailable { get; init; }
    
    [JsonPropertyName("dxgiError")]
    public string? DxgiError { get; init; }
    
    [JsonPropertyName("audioInputAvailable")]
    public bool AudioInputAvailable { get; init; }
    
    [JsonPropertyName("audioInputError")]
    public string? AudioInputError { get; init; }
    
    [JsonPropertyName("audioOutputAvailable")]
    public bool AudioOutputAvailable { get; init; }
    
    [JsonPropertyName("audioOutputError")]
    public string? AudioOutputError { get; init; }
    
    [JsonPropertyName("probedAtUnixMs")]
    public ulong ProbedAtUnixMs { get; init; }
}
