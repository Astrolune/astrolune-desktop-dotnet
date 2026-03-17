namespace Astrolune.Sdk.Modules;

/// <summary>
/// Module health status.
/// </summary>
public enum ModuleHealthStatus
{
    /// <summary>
    /// Module is healthy.
    /// </summary>
    Healthy,
    
    /// <summary>
    /// Module has warnings.
    /// </summary>
    Warning,
    
    /// <summary>
    /// Module is unhealthy.
    /// </summary>
    Unhealthy,
    
    /// <summary>
    /// Module health is unknown.
    /// </summary>
    Unknown
}
