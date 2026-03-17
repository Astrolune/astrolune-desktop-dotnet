using System.Text.Json;
using System.Text.Json.Serialization;

namespace Astrolune.Sdk.Modules;

/// <summary>
/// Module manifest metadata.
/// </summary>
public sealed class ModuleManifest : IModuleManifest
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("version")]
    public string Version { get; init; } = string.Empty;

    [JsonPropertyName("author")]
    public string Author { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; init; } = string.Empty;

    [JsonPropertyName("category")]
    public string Category { get; init; } = string.Empty;

    [JsonPropertyName("permissions")]
    public IReadOnlyList<string> Permissions { get; init; } = Array.Empty<string>();

    [JsonPropertyName("dependencies")]
    public IReadOnlyList<ModuleDependency> Dependencies { get; init; } = Array.Empty<ModuleDependency>();

    [JsonPropertyName("entryPoint")]
    public string EntryPoint { get; init; } = string.Empty;

    [JsonPropertyName("minHostVersion")]
    public string MinHostVersion { get; init; } = string.Empty;

    [JsonPropertyName("minSdkVersion")]
    public string MinSdkVersion { get; init; } = string.Empty;

    [JsonPropertyName("signature")]
    public string Signature { get; init; } = string.Empty;

    [JsonPropertyName("updateRepository")]
    public string UpdateRepository { get; init; } = string.Empty;

    [JsonPropertyName("buildConfiguration")]
    public string BuildConfiguration { get; init; } = "bundled";

    public Version? ParsedVersion => System.Version.TryParse(Version, out var parsed) ? parsed : null;

    public Version? ParsedMinHostVersion => System.Version.TryParse(MinHostVersion, out var parsed) ? parsed : null;

    public Version? ParsedMinSdkVersion => System.Version.TryParse(MinSdkVersion, out var parsed) ? parsed : null;

    public SemanticVersion? ParsedSemanticVersion
    {
        get
        {
            SemanticVersion.TryParse(Version, out var parsed);
            return parsed;
        }
    }

    public ModuleBuildConfiguration ParsedBuildConfiguration
    {
        get
        {
            return Enum.TryParse<ModuleBuildConfiguration>(BuildConfiguration, ignoreCase: true, out var result)
                ? result
                : ModuleBuildConfiguration.Bundled;
        }
    }

    public static ModuleManifest Load(string path)
    {
        var json = File.ReadAllText(path);
        var manifest = JsonSerializer.Deserialize<ModuleManifest>(json, SerializerOptions);
        if (manifest is null)
        {
            throw new InvalidDataException($"Unable to parse module manifest at {path}.");
        }

        return manifest;
    }
}
