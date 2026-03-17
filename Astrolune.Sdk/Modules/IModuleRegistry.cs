namespace Astrolune.Sdk.Modules;

/// <summary>
/// Registry for managing loaded modules.
/// </summary>
public interface IModuleRegistry
{
    /// <summary>
    /// Get all registered modules.
    /// </summary>
    IReadOnlyList<IModuleInfo> GetModules();
    
    /// <summary>
    /// Get a module by ID.
    /// </summary>
    IModuleInfo? GetModule(string moduleId);
    
    /// <summary>
    /// Check if a module is registered.
    /// </summary>
    bool IsModuleRegistered(string moduleId);
    
    /// <summary>
    /// Register a module.
    /// </summary>
    void RegisterModule(IModuleInfo module);
    
    /// <summary>
    /// Unregister a module.
    /// </summary>
    void UnregisterModule(string moduleId);
}
