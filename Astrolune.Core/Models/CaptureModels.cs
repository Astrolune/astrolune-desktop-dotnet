using System.Text.Json.Serialization;

namespace Astrolune.Core.Models;

public sealed record CaptureSource
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("kind")]
    public required string Kind { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("thumbnail")]
    public required string Thumbnail { get; init; }

    [JsonPropertyName("width")]
    public required uint Width { get; init; }

    [JsonPropertyName("height")]
    public required uint Height { get; init; }

    [JsonPropertyName("isPrimary")]
    public required bool IsPrimary { get; init; }
}

public sealed record ScreenCaptureRequest
{
    [JsonPropertyName("sourceId")]
    public string? SourceId { get; init; }

    [JsonPropertyName("fps")]
    public uint? Fps { get; init; }

    [JsonPropertyName("cursor")]
    public bool? Cursor { get; init; }
}

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

public sealed record ScreenCaptureState
{
    [JsonPropertyName("sessionId")]
    public required string SessionId { get; init; }

    [JsonPropertyName("status")]
    public required string Status { get; init; }

    [JsonPropertyName("message")]
    public string? Message { get; init; }
}

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

public sealed record AudioCaptureState
{
    [JsonPropertyName("sessionId")]
    public required string SessionId { get; init; }

    [JsonPropertyName("status")]
    public required string Status { get; init; }

    [JsonPropertyName("message")]
    public string? Message { get; init; }
}

public sealed record AudioDevice
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
