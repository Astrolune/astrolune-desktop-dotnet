using System.IO;
using System.Security.Cryptography;
using System.Text.Json;

namespace Astrolune.Desktop.Modules;

public sealed class ModulePermissionStore
{
    private readonly string _path;
    private readonly object _sync = new();
    private Dictionary<string, HashSet<string>> _cache;

    public ModulePermissionStore(string path)
    {
        _path = path;
        _cache = Load();
    }

    public IReadOnlyCollection<string> GetPermissions(string moduleId)
    {
        lock (_sync)
        {
            return _cache.TryGetValue(moduleId, out var permissions)
                ? permissions.ToArray()
                : Array.Empty<string>();
        }
    }

    public void GrantPermissions(string moduleId, IEnumerable<string> permissions)
    {
        lock (_sync)
        {
            if (!_cache.TryGetValue(moduleId, out var existing))
            {
                existing = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                _cache[moduleId] = existing;
            }

            foreach (var permission in permissions)
            {
                existing.Add(permission);
            }

            Save();
        }
    }

    public void RevokePermission(string moduleId, string permission)
    {
        lock (_sync)
        {
            if (!_cache.TryGetValue(moduleId, out var existing))
            {
                return;
            }

            existing.RemoveWhere(item => string.Equals(item, permission, StringComparison.OrdinalIgnoreCase));
            if (existing.Count == 0)
            {
                _cache.Remove(moduleId);
            }

            Save();
        }
    }

    private Dictionary<string, HashSet<string>> Load()
    {
        try
        {
            if (!File.Exists(_path))
            {
                return new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            }

            var encrypted = File.ReadAllBytes(_path);
            var data = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
            var json = JsonSerializer.Deserialize<Dictionary<string, List<string>?>>(data);
            if (json is null)
            {
                return new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            }

            return json.ToDictionary(
                pair => pair.Key,
                pair => new HashSet<string>(pair.Value ?? new List<string>(), StringComparer.OrdinalIgnoreCase),
                StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            return new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private void Save()
    {
        var directory = Path.GetDirectoryName(_path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var payload = _cache.ToDictionary(
            pair => pair.Key,
            pair => pair.Value.ToArray(),
            StringComparer.OrdinalIgnoreCase);

        var json = JsonSerializer.SerializeToUtf8Bytes(payload, new JsonSerializerOptions { WriteIndented = true });
        var encrypted = ProtectedData.Protect(json, null, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(_path, encrypted);
    }
}
