namespace Astrolune.Sdk.Modules;

/// <summary>
/// Module build configuration - controls how the module is built and distributed.
/// </summary>
public enum ModuleBuildConfiguration
{
    /// <summary>
    /// Module is built together with the main client.
    /// </summary>
    Bundled,
    
    /// <summary>
    /// Module is built separately and distributed independently.
    /// </summary>
    Standalone,
    
    /// <summary>
    /// Module is not built (development only).
    /// </summary>
    None
}
