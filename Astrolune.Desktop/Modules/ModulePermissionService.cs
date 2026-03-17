using Astrolune.Sdk.Modules;

namespace Astrolune.Desktop.Modules;

public sealed class ModulePermissionService : IModulePermissionService
{
    private readonly ModulePermissionStore _store;
    private readonly IModuleUserPrompt _prompt;

    public ModulePermissionService(ModulePermissionStore store, IModuleUserPrompt prompt)
    {
        _store = store;
        _prompt = prompt;
    }

    public Task<bool> EnsurePermissionsAsync(ModuleManifest manifest, CancellationToken cancellationToken = default)
    {
        if (manifest.Permissions.Count == 0)
        {
            return Task.FromResult(true);
        }

        var missing = manifest.Permissions
            .Where(permission => !IsPermissionGranted(manifest.Id, permission))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (missing.Length == 0)
        {
            return Task.FromResult(true);
        }

        var allow = _prompt.RequestPermissions(manifest, missing);
        if (!allow)
        {
            return Task.FromResult(false);
        }

        _store.GrantPermissions(manifest.Id, missing);
        return Task.FromResult(true);
    }

    public bool HasPermission(string moduleId, string permission)
    {
        var granted = _store.GetPermissions(moduleId);
        return granted.Any(p => string.Equals(p, permission, StringComparison.OrdinalIgnoreCase));
    }

    public void GrantPermission(string moduleId, string permission)
    {
        _store.GrantPermissions(moduleId, new[] { permission });
    }

    public void RevokePermission(string moduleId, string permission)
    {
        _store.RevokePermission(moduleId, permission);
    }

    public IReadOnlyCollection<string> GetGrantedPermissions(string moduleId)
        => _store.GetPermissions(moduleId);

    private bool IsPermissionGranted(string moduleId, string permission)
        => HasPermission(moduleId, permission);
}
