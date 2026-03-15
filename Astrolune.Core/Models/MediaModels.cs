using System.Text.Json.Serialization;

namespace Astrolune.Core.Models;

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

public sealed record ProbeStepEvent
{
    [JsonPropertyName("label")]
    public required string Label { get; init; }

    [JsonPropertyName("ok")]
    public required bool Ok { get; init; }

    [JsonPropertyName("message")]
    public required string Message { get; init; }
}

public sealed record AudioInputDevice
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("isDefault")]
    public required bool IsDefault { get; init; }
}

public sealed record MediaDevice
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("kind")]
    public required string Kind { get; init; }

    [JsonPropertyName("isDefault")]
    public required bool IsDefault { get; init; }
}

public sealed record MediaDevicesSnapshot
{
    [JsonPropertyName("audioInputs")]
    public required IReadOnlyList<MediaDevice> AudioInputs { get; init; }

    [JsonPropertyName("audioOutputs")]
    public required IReadOnlyList<MediaDevice> AudioOutputs { get; init; }

    [JsonPropertyName("videoInputs")]
    public required IReadOnlyList<MediaDevice> VideoInputs { get; init; }
}

public sealed record StartVoiceRequest
{
    [JsonPropertyName("inputDeviceId")]
    public string? InputDeviceId { get; init; }
}

public sealed record StartCameraRequest
{
    [JsonPropertyName("deviceId")]
    public string? DeviceId { get; init; }

    [JsonPropertyName("resolution")]
    public uint[]? Resolution { get; init; }

    [JsonPropertyName("fps")]
    public uint? Fps { get; init; }
}

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

public sealed record ConnectLivekitRequest
{
    [JsonPropertyName("livekitUrl")]
    public required string LivekitUrl { get; init; }

    [JsonPropertyName("token")]
    public required string Token { get; init; }
}
