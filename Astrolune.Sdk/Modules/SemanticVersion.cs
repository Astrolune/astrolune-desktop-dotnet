using System.Text.Json;
using System.Text.Json.Serialization;

namespace Astrolune.Sdk.Modules;

/// <summary>
/// Semantic version representation.
/// </summary>
public sealed record SemanticVersion
{
    public int Major { get; init; }
    public int Minor { get; init; }
    public int Patch { get; init; }
    public string? PreRelease { get; init; }

    public static bool TryParse(string version, out SemanticVersion? result)
    {
        if (System.Version.TryParse(version, out var parsed))
        {
            result = new SemanticVersion
            {
                Major = parsed.Major,
                Minor = parsed.Minor,
                Patch = parsed.Build >= 0 ? parsed.Build : 0,
                PreRelease = null
            };
            return true;
        }

        result = null;
        return false;
    }

    public static SemanticVersion Parse(string version)
    {
        if (!TryParse(version, out var result))
        {
            throw new FormatException($"Invalid semantic version: {version}");
        }

        return result;
    }

    public int CompareTo(SemanticVersion? other)
    {
        if (other is null) return 1;

        var majorCompare = Major.CompareTo(other.Major);
        if (majorCompare != 0) return majorCompare;

        var minorCompare = Minor.CompareTo(other.Minor);
        if (minorCompare != 0) return minorCompare;

        return Patch.CompareTo(other.Patch);
    }

    public override string ToString() => $"{Major}.{Minor}.{Patch}{(PreRelease != null ? $"-{PreRelease}" : "")}";
}
