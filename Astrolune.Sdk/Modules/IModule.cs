namespace Astrolune.Sdk.Modules;

/// <summary>
/// Base interface for all Astrolune modules.
/// </summary>
public interface IModule
{
    /// <summary>
    /// Register module services in the DI container.
    /// </summary>
    void Register(IServiceCollection services);
    
    /// <summary>
    /// Initialize the module after all services are registered.
    /// </summary>
    void Initialize();
    
    /// <summary>
    /// Shutdown the module and release resources.
    /// </summary>
    void Shutdown();
}
