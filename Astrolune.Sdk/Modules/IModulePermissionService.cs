using System.Threading;
using System.Threading.Tasks;

namespace Astrolune.Sdk.Modules;

/// <summary>
/// Service for managing module permissions.
/// </summary>
public interface IModulePermissionService
{
    /// <summary>
    /// Check if a module has a specific permission.
    /// </summary>
    bool HasPermission(string moduleId, string permission);
    
    /// <summary>
    /// Grant a permission to a module.
    /// </summary>
    void GrantPermission(string moduleId, string permission);
    
    /// <summary>
    /// Revoke a permission from a module.
    /// </summary>
    void RevokePermission(string moduleId, string permission);
    
    /// <summary>
    /// Ensure permissions for a module.
    /// </summary>
    Task<bool> EnsurePermissionsAsync(ModuleManifest manifest, CancellationToken cancellationToken = default);
}
