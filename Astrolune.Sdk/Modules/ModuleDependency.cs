using System.Text.Json.Serialization;

namespace Astrolune.Sdk.Modules;

/// <summary>
/// Module dependency.
/// </summary>
public sealed record ModuleDependency
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    
    [JsonPropertyName("version")]
    public required string Version { get; init; }

    [JsonIgnore]
    public SemanticVersion? ParsedSemanticVersion
    {
        get
        {
            SemanticVersion.TryParse(Version, out var parsed);
            return parsed;
        }
    }
}
