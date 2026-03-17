namespace Astrolune.Sdk.Modules;

/// <summary>
/// Validates module manifests for required fields.
/// </summary>
public static class ModuleManifestValidator
{
    public static IReadOnlyList<string> Validate(ModuleManifest manifest)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(manifest.Id))
        {
            errors.Add("id is required.");
        }

        if (string.IsNullOrWhiteSpace(manifest.Name))
        {
            errors.Add("name is required.");
        }

        if (string.IsNullOrWhiteSpace(manifest.Version))
        {
            errors.Add("version is required.");
        }

        if (string.IsNullOrWhiteSpace(manifest.EntryPoint))
        {
            errors.Add("entryPoint is required.");
        }

        foreach (var dependency in manifest.Dependencies)
        {
            if (string.IsNullOrWhiteSpace(dependency.Id))
            {
                errors.Add("dependency id is required.");
            }

            if (string.IsNullOrWhiteSpace(dependency.Version))
            {
                errors.Add($"dependency version is required for {dependency.Id}.");
            }
        }

        return errors;
    }
}
