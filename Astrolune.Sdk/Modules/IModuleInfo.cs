namespace Astrolune.Sdk.Modules;

/// <summary>
/// Module information.
/// </summary>
public interface IModuleInfo
{
    /// <summary>
    /// Module ID.
    /// </summary>
    string Id { get; }
    
    /// <summary>
    /// Module name.
    /// </summary>
    string Name { get; }
    
    /// <summary>
    /// Module version.
    /// </summary>
    string Version { get; }
    
    /// <summary>
    /// Module status.
    /// </summary>
    ModuleStatus Status { get; }
    
    /// <summary>
    /// Module manifest.
    /// </summary>
    IModuleManifest Manifest { get; }
    
    /// <summary>
    /// Build configuration.
    /// </summary>
    ModuleBuildConfiguration BuildConfiguration { get; }
}
