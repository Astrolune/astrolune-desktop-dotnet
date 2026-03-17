namespace Astrolune.Sdk.Models;

/// <summary>
/// Start voice request.
/// </summary>
public sealed record StartVoiceRequest
{
    [JsonPropertyName("inputDeviceId")]
    public string? InputDeviceId { get; init; }
}
