using Astrolune.Sdk.Modules;

namespace Astrolune.Desktop.Modules;

public sealed class ModuleRegistry : IModuleRegistry
{
    private readonly Dictionary<string, ModuleInfo> _modules = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _sync = new();

    public IReadOnlyCollection<ModuleInfo> Modules
    {
        get
        {
            lock (_sync)
            {
                return _modules.Values.ToList();
            }
        }
    }

    public IReadOnlyList<IModuleInfo> GetModules()
    {
        lock (_sync)
        {
            return _modules.Values.Cast<IModuleInfo>().ToList();
        }
    }

    public IModuleInfo? GetModule(string moduleId)
        => Get(moduleId);

    public ModuleInfo? Get(string moduleId)
    {
        lock (_sync)
        {
            return _modules.TryGetValue(moduleId, out var module) ? module : null;
        }
    }

    public bool IsModuleRegistered(string moduleId)
    {
        lock (_sync)
        {
            return _modules.ContainsKey(moduleId);
        }
    }

    public void RegisterModule(IModuleInfo module)
    {
        lock (_sync)
        {
            _modules[module.Id] = new ModuleInfo(module);
        }
    }

    public void UnregisterModule(string moduleId)
    {
        lock (_sync)
        {
            _modules.Remove(moduleId);
        }
    }

    public void UpdateStatus(ModuleManifest manifest, ModuleStatus status, string? error = null)
    {
        lock (_sync)
        {
            var info = GetOrCreate(manifest);
            info.Status = status;
            info.Error = error;
            if (status is ModuleStatus.Failed or ModuleStatus.Disabled)
            {
                info.IsDegraded = true;
            }
        }
    }

    public void UpdateHealth(ModuleManifest manifest, ModuleHealthResult result)
    {
        lock (_sync)
        {
            var info = GetOrCreate(manifest);
            info.Health = result;
            info.Error = result.Message;
            info.IsDegraded = result.Status is ModuleHealthStatus.Warning or ModuleHealthStatus.Unhealthy;
            if (info.IsDegraded && info.Status == ModuleStatus.Loaded)
            {
                info.Status = ModuleStatus.Degraded;
            }
        }
    }

    public void MarkPendingUpdate(ModuleManifest manifest, Version availableVersion)
    {
        lock (_sync)
        {
            var info = GetOrCreate(manifest);
            info.PendingVersion = availableVersion;
            if (info.Status == ModuleStatus.Loaded)
            {
                info.Status = ModuleStatus.PendingUpdate;
            }
        }
    }

    public void ClearPendingUpdate(ModuleManifest manifest)
    {
        lock (_sync)
        {
            var info = GetOrCreate(manifest);
            info.PendingVersion = null;
            if (info.Status == ModuleStatus.PendingUpdate)
            {
                info.Status = ModuleStatus.Loaded;
            }
        }
    }

    private ModuleInfo GetOrCreate(ModuleManifest manifest)
    {
        if (_modules.TryGetValue(manifest.Id, out var existing))
        {
            return existing;
        }

        var created = new ModuleInfo(manifest);
        _modules[manifest.Id] = created;
        return created;
    }

    public sealed class ModuleInfo : IModuleInfo
    {
        public ModuleInfo(ModuleManifest manifest)
        {
            Manifest = manifest;
            Id = manifest.Id;
            Name = manifest.Name;
            Version = manifest.Version;
            BuildConfiguration = manifest.ParsedBuildConfiguration;
            Status = ModuleStatus.Unloaded;
        }

        public ModuleInfo(IModuleInfo info)
        {
            Manifest = info.Manifest;
            Id = info.Id;
            Name = info.Name;
            Version = info.Version;
            BuildConfiguration = info.BuildConfiguration;
            Status = info.Status;
        }

        public string Id { get; }
        public string Name { get; }
        public string Version { get; }
        public ModuleStatus Status { get; internal set; }
        public IModuleManifest Manifest { get; }
        public ModuleBuildConfiguration BuildConfiguration { get; }

        public string? Error { get; internal set; }
        public bool IsDegraded { get; internal set; }
        public ModuleHealthResult? Health { get; internal set; }
        public Version? PendingVersion { get; internal set; }
    }
}
