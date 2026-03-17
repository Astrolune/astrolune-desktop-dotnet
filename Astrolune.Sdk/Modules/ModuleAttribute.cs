namespace Astrolune.Sdk.Modules;

/// <summary>
/// Declares module metadata on the module class.
/// </summary>
[AttributeUsage(AttributeTargets.Class, Inherited = false, AllowMultiple = false)]
public sealed class ModuleAttribute : Attribute
{
    public ModuleAttribute(string id)
    {
        Id = id;
    }

    public string Id { get; }

    public string? Version { get; init; }

    public string? Author { get; init; }
}
