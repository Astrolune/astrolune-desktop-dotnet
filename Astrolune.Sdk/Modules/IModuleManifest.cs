namespace Astrolune.Sdk.Modules;

/// <summary>
/// Module manifest metadata.
/// </summary>
public interface IModuleManifest
{
    /// <summary>
    /// Unique module identifier.
    /// </summary>
    string Id { get; }
    
    /// <summary>
    /// Human-readable module name.
    /// </summary>
    string Name { get; }
    
    /// <summary>
    /// Module version.
    /// </summary>
    string Version { get; }
    
    /// <summary>
    /// Module author.
    /// </summary>
    string Author { get; }
    
    /// <summary>
    /// Module description.
    /// </summary>
    string Description { get; }
    
    /// <summary>
    /// Module category.
    /// </summary>
    string Category { get; }
    
    /// <summary>
    /// Module entry point type.
    /// </summary>
    string EntryPoint { get; }
    
    /// <summary>
    /// Minimum required host version.
    /// </summary>
    string MinHostVersion { get; }
    
    /// <summary>
    /// Minimum required SDK version.
    /// </summary>
    string MinSdkVersion { get; }
}
