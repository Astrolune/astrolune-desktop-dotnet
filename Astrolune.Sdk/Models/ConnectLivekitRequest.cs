namespace Astrolune.Sdk.Models;

/// <summary>
/// Connect LiveKit request.
/// </summary>
public sealed record ConnectLivekitRequest
{
    [JsonPropertyName("livekitUrl")]
    public required string LivekitUrl { get; init; }
    
    [JsonPropertyName("token")]
    public required string Token { get; init; }
}
