namespace Astrolune.Sdk.Modules;

/// <summary>
/// Module status.
/// </summary>
public enum ModuleStatus
{
    /// <summary>
    /// Module is not loaded.
    /// </summary>
    Unloaded,
    
    /// <summary>
    /// Module is loading.
    /// </summary>
    Loading,
    
    /// <summary>
    /// Module is loaded and active.
    /// </summary>
    Loaded,
    
    /// <summary>
    /// Module is disabled.
    /// </summary>
    Disabled,
    
    /// <summary>
    /// Module failed to load or crashed.
    /// </summary>
    Failed,

    /// <summary>
    /// Module is degraded but still running.
    /// </summary>
    Degraded,

    /// <summary>
    /// Module is unofficial (unsigned).
    /// </summary>
    Unofficial,

    /// <summary>
    /// Module has a pending update.
    /// </summary>
    PendingUpdate,

    /// <summary>
    /// Module is in error state.
    /// </summary>
    Error
}
