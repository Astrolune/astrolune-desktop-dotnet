namespace Astrolune.Sdk.Modules;

/// <summary>
/// Interface for module health checks.
/// </summary>
public interface IModuleHealthCheck
{
    /// <summary>
    /// Check the health of the module.
    /// </summary>
    Task<ModuleHealthResult> CheckAsync(CancellationToken cancellationToken = default);
}
