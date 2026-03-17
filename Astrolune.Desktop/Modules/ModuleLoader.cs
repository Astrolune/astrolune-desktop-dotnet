using System.IO;
using System.Reflection;
using System.Runtime.Loader;
using Astrolune.Sdk.Modules;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Astrolune.Desktop.Modules;

public sealed class ModuleLoader : IHostedService
{
    private readonly ModuleLoaderOptions _options;
    private readonly ModuleRegistry _registry;
    private readonly ModuleSignatureVerifier _signatureVerifier;
    private readonly IModulePermissionService _permissionService;
    private readonly IModuleUserPrompt _userPrompt;
    private readonly ILogger<ModuleLoader> _logger;
    private readonly List<LoadedModule> _loadedModules = new();
    private readonly List<FileStream> _locks = new();
    private Timer? _healthTimer;

    public ModuleLoader(
        ModuleLoaderOptions options,
        ModuleRegistry registry,
        ModuleSignatureVerifier signatureVerifier,
        IModulePermissionService permissionService,
        IModuleUserPrompt userPrompt,
        ILogger<ModuleLoader> logger)
    {
        _options = options;
        _registry = registry;
        _signatureVerifier = signatureVerifier;
        _permissionService = permissionService;
        _userPrompt = userPrompt;
        _logger = logger;
    }

    public IReadOnlyList<LoadedModule> LoadedModules => _loadedModules;

    public void DiscoverAndRegisterModules(IServiceCollection services)
    {
        Directory.CreateDirectory(_options.ModulesRoot);
        ApplyPendingUpdates();

        var candidates = DiscoverModules();
        var ordered = VerifyAndOrderModules(candidates);
        LoadModules(ordered, services);
    }

    public List<ModuleCandidate> DiscoverModules()
    {
        var candidates = new List<ModuleCandidate>();
        foreach (var directory in Directory.GetDirectories(_options.ModulesRoot))
        {
            if (string.Equals(Path.GetFileName(directory), ".pending", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var manifestPath = Path.Combine(directory, "module.manifest.json");
            if (!File.Exists(manifestPath))
            {
                continue;
            }

            try
            {
                var manifest = ModuleManifest.Load(manifestPath);
                var dllPath = Path.Combine(directory, $"{manifest.Id}.dll");
                var signaturePath = Path.Combine(directory, "module.sig");
                candidates.Add(new ModuleCandidate(manifest, directory, manifestPath, dllPath, signaturePath));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load manifest in {Directory}.", directory);
            }
        }

        return candidates;
    }

    public List<ModuleCandidate> VerifyAndOrderModules(List<ModuleCandidate> candidates)
    {
        var ordered = new List<ModuleCandidate>();
        var byId = new Dictionary<string, ModuleCandidate>(StringComparer.OrdinalIgnoreCase);
        var visitState = new Dictionary<string, VisitState>(StringComparer.OrdinalIgnoreCase);
        var blocked = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in candidates)
        {
            if (byId.ContainsKey(candidate.Manifest.Id))
            {
                _registry.UpdateStatus(candidate.Manifest, ModuleStatus.Failed, "Duplicate module id detected.");
                blocked.Add(candidate.Manifest.Id);
                continue;
            }

            byId[candidate.Manifest.Id] = candidate;
        }

        foreach (var candidate in candidates)
        {
            if (!ValidateCandidate(candidate))
            {
                blocked.Add(candidate.Manifest.Id);
            }
        }

        foreach (var candidate in candidates)
        {
            Visit(candidate);
        }

        return ordered;

        void Visit(ModuleCandidate candidate)
        {
            var id = candidate.Manifest.Id;
            if (blocked.Contains(id))
            {
                return;
            }

            if (visitState.TryGetValue(id, out var state))
            {
                if (state == VisitState.Visiting)
                {
                    _registry.UpdateStatus(candidate.Manifest, ModuleStatus.Failed, "Dependency cycle detected.");
                    blocked.Add(id);
                }

                return;
            }

            visitState[id] = VisitState.Visiting;

            foreach (var dependency in candidate.Manifest.Dependencies)
            {
                if (!byId.TryGetValue(dependency.Id, out var dependencyCandidate))
                {
                    _registry.UpdateStatus(candidate.Manifest, ModuleStatus.Failed, $"Missing dependency {dependency.Id}.");
                    blocked.Add(id);
                    visitState[id] = VisitState.Visited;
                    return;
                }

                if (!IsVersionSatisfied(dependency, dependencyCandidate.Manifest))
                {
                    _registry.UpdateStatus(candidate.Manifest, ModuleStatus.Failed, $"Dependency {dependency.Id} does not satisfy version {dependency.Version}.");
                    blocked.Add(id);
                    visitState[id] = VisitState.Visited;
                    return;
                }

                Visit(dependencyCandidate);
                if (blocked.Contains(dependency.Id))
                {
                    _registry.UpdateStatus(candidate.Manifest, ModuleStatus.Failed, $"Dependency {dependency.Id} failed to load.");
                    blocked.Add(id);
                    visitState[id] = VisitState.Visited;
                    return;
                }
            }

            visitState[id] = VisitState.Visited;
            ordered.Add(candidate);
        }
    }

    public void LoadModules(IEnumerable<ModuleCandidate> ordered, IServiceCollection services)
    {
        foreach (var candidate in ordered)
        {
            LoadModule(candidate, services);
        }
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        return StartModulesAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        StopHealthMonitor();

        for (var i = _loadedModules.Count - 1; i >= 0; i--)
        {
            try
            {
                _loadedModules[i].Instance.Shutdown();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Module {ModuleId} failed to shutdown cleanly.", _loadedModules[i].Manifest.Id);
            }
        }

        foreach (var handle in _locks)
        {
            handle.Dispose();
        }

        return Task.CompletedTask;
    }

    public async Task StartModulesAsync(CancellationToken cancellationToken)
    {
        await InitializeModulesAsync(cancellationToken).ConfigureAwait(false);
        await RunInitialHealthChecksAsync(cancellationToken).ConfigureAwait(false);
        StartHealthMonitor();
    }

    public Task InitializeModulesAsync(CancellationToken cancellationToken)
    {
        foreach (var module in _loadedModules)
        {
            try
            {
                module.Instance.Initialize();
            }
            catch (Exception ex)
            {
                _registry.UpdateStatus(module.Manifest, ModuleStatus.Failed, ex.Message);
                _logger.LogError(ex, "Module {ModuleId} failed to initialize.", module.Manifest.Id);
            }
        }

        return Task.CompletedTask;
    }

    public async Task RunInitialHealthChecksAsync(CancellationToken cancellationToken)
    {
        foreach (var module in _loadedModules)
        {
            try
            {
                await RunHealthCheckAsync(module, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _registry.UpdateStatus(module.Manifest, ModuleStatus.Failed, ex.Message);
                _logger.LogError(ex, "Module {ModuleId} failed initial health checks.", module.Manifest.Id);
            }
        }
    }

    public void StartHealthMonitor()
    {
        _healthTimer = new Timer(
            _ => _ = RunPeriodicHealthChecksAsync(),
            null,
            _options.HealthCheckInterval,
            _options.HealthCheckInterval);
    }

    public void StopHealthMonitor()
    {
        _healthTimer?.Dispose();
    }

    public void ApplyPendingUpdates()
    {
        foreach (var moduleDir in Directory.GetDirectories(_options.ModulesRoot))
        {
            var pendingDir = Path.Combine(moduleDir, ".pending");
            if (!Directory.Exists(pendingDir))
            {
                continue;
            }

            foreach (var file in Directory.GetFiles(pendingDir, "*", SearchOption.AllDirectories))
            {
                var relative = Path.GetRelativePath(pendingDir, file);
                var destination = Path.Combine(moduleDir, relative);
                var destinationDir = Path.GetDirectoryName(destination);
                if (!string.IsNullOrWhiteSpace(destinationDir))
                {
                    Directory.CreateDirectory(destinationDir);
                }

                File.Copy(file, destination, overwrite: true);
            }

            try
            {
                Directory.Delete(pendingDir, recursive: true);
            }
            catch
            {
                // Best-effort cleanup.
            }
        }
    }

    private bool ValidateCandidate(ModuleCandidate candidate)
    {
        var manifest = candidate.Manifest;
        var errors = ModuleManifestValidator.Validate(manifest);
        if (errors.Count > 0)
        {
            _registry.UpdateStatus(manifest, ModuleStatus.Failed, $"Manifest invalid: {string.Join("; ", errors)}");
            return false;
        }

        if (!File.Exists(candidate.DllPath))
        {
            _registry.UpdateStatus(manifest, ModuleStatus.Failed, "Module assembly is missing.");
            return false;
        }

        if (manifest.ParsedMinHostVersion is null)
        {
            _registry.UpdateStatus(manifest, ModuleStatus.Failed, "minHostVersion is invalid.");
            return false;
        }

        if (manifest.ParsedMinHostVersion > _options.HostVersion)
        {
            _registry.UpdateStatus(manifest, ModuleStatus.Failed, $"Requires host version {manifest.ParsedMinHostVersion}.");
            return false;
        }

        if (manifest.ParsedMinSdkVersion is null)
        {
            _registry.UpdateStatus(manifest, ModuleStatus.Failed, "minSdkVersion is invalid.");
            return false;
        }

        if (manifest.ParsedMinSdkVersion > _options.SdkVersion)
        {
            _registry.UpdateStatus(manifest, ModuleStatus.Failed, $"Requires SDK version {manifest.ParsedMinSdkVersion}.");
            return false;
        }

        var unknownPermissions = manifest.Permissions
            .Where(permission => !ModulePermissions.IsKnown(permission))
            .ToList();
        if (unknownPermissions.Count > 0)
        {
            _registry.UpdateStatus(
                manifest,
                ModuleStatus.Failed,
                $"Unknown permissions: {string.Join(", ", unknownPermissions)}");
            return false;
        }

        var signatureCheck = _signatureVerifier.Verify(candidate.ManifestPath, candidate.DllPath, candidate.SignaturePath, out var reason);
        if (signatureCheck == ModuleSignatureCheck.Missing)
        {
            var shouldContinue = _userPrompt.ConfirmUnsignedModule(manifest);
            if (!shouldContinue)
            {
                _registry.UpdateStatus(manifest, ModuleStatus.Disabled, reason ?? "Signature missing.");
                return false;
            }

            candidate.IsUnofficial = true;
        }
        else if (signatureCheck is ModuleSignatureCheck.Invalid or ModuleSignatureCheck.Error)
        {
            _registry.UpdateStatus(manifest, ModuleStatus.Failed, reason ?? "Signature validation failed.");
            _logger.LogWarning("Module {ModuleId} failed signature validation: {Reason}", manifest.Id, reason ?? "Unknown error");
            return false;
        }

        return true;
    }

    private static bool IsVersionSatisfied(ModuleDependency dependency, ModuleManifest manifest)
    {
        var required = dependency.ParsedSemanticVersion;
        var available = manifest.ParsedSemanticVersion;
        if (required is null || available is null)
        {
            return true;
        }

        return available.CompareTo(required) >= 0;
    }

    private void LoadModule(ModuleCandidate candidate, IServiceCollection services)
    {
        var manifest = candidate.Manifest;

        try
        {
            var permissionsGranted = _permissionService.EnsurePermissionsAsync(manifest).GetAwaiter().GetResult();
            if (!permissionsGranted)
            {
                _registry.UpdateStatus(manifest, ModuleStatus.Disabled, "Permissions denied.");
                return;
            }

            var assemblyName = AssemblyName.GetAssemblyName(candidate.DllPath);
            if (!string.Equals(assemblyName.Name, manifest.Id, StringComparison.OrdinalIgnoreCase))
            {
                _registry.UpdateStatus(manifest, ModuleStatus.Failed, "Assembly name does not match manifest id.");
                return;
            }

            var sharedAssemblies = new[]
            {
                typeof(IModule).Assembly.GetName().Name ?? string.Empty,
                typeof(IServiceCollection).Assembly.GetName().Name ?? string.Empty
            };

            var loadContext = new ModuleLoadContext(candidate.DllPath, sharedAssemblies);
            var assembly = loadContext.LoadFromAssemblyPath(candidate.DllPath);
            var moduleType = assembly.GetType(manifest.EntryPoint, throwOnError: false, ignoreCase: false);
            if (moduleType is null)
            {
                throw new InvalidOperationException($"Entry point {manifest.EntryPoint} not found.");
            }

            if (!typeof(IModule).IsAssignableFrom(moduleType))
            {
                throw new InvalidOperationException($"Entry point {manifest.EntryPoint} does not implement IModule.");
            }

            var module = (IModule)Activator.CreateInstance(moduleType)!;
            module.Register(services);

            _loadedModules.Add(new LoadedModule(manifest, module, loadContext));
            _registry.ClearPendingUpdate(manifest);
            _registry.UpdateStatus(manifest, candidate.IsUnofficial ? ModuleStatus.Unofficial : ModuleStatus.Loaded);

            LockModuleFiles(candidate);
        }
        catch (Exception ex)
        {
            _registry.UpdateStatus(manifest, ModuleStatus.Failed, ex.Message);
            _logger.LogError(ex, "Module {ModuleId} failed to load.", manifest.Id);
        }
    }

    private void LockModuleFiles(ModuleCandidate candidate)
    {
        LockFile(candidate.DllPath);
        LockFile(candidate.ManifestPath);
        if (File.Exists(candidate.SignaturePath))
        {
            LockFile(candidate.SignaturePath);
        }
    }

    private void LockFile(string path)
    {
        try
        {
            _locks.Add(new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to lock module file {Path}.", path);
        }
    }

    private async Task RunPeriodicHealthChecksAsync()
    {
        foreach (var module in _loadedModules)
        {
            await RunHealthCheckAsync(module, CancellationToken.None).ConfigureAwait(false);
        }
    }

    private Task RunHealthCheckAsync(LoadedModule module, CancellationToken cancellationToken)
    {
        if (module.Instance is not IModuleHealthCheck healthCheck)
        {
            return Task.CompletedTask;
        }

        return RunHealthCheckInternalAsync(module, healthCheck, cancellationToken);
    }

    private async Task RunHealthCheckInternalAsync(LoadedModule module, IModuleHealthCheck healthCheck, CancellationToken cancellationToken)
    {
        try
        {
            var result = await healthCheck.CheckAsync(cancellationToken).ConfigureAwait(false);
            _registry.UpdateHealth(module.Manifest, result);
        }
        catch (Exception ex)
        {
            _registry.UpdateHealth(module.Manifest, new ModuleHealthResult
            {
                ModuleId = module.Manifest.Id,
                Status = ModuleHealthStatus.Warning,
                Message = ex.Message
            });
            _logger.LogWarning(ex, "Module {ModuleId} health check failed.", module.Manifest.Id);
        }
    }

    public sealed class ModuleCandidate
    {
        public ModuleCandidate(ModuleManifest manifest, string directory, string manifestPath, string dllPath, string signaturePath)
        {
            Manifest = manifest;
            Directory = directory;
            ManifestPath = manifestPath;
            DllPath = dllPath;
            SignaturePath = signaturePath;
        }

        public ModuleManifest Manifest { get; }
        public string Directory { get; }
        public string ManifestPath { get; }
        public string DllPath { get; }
        public string SignaturePath { get; }
        public bool IsUnofficial { get; set; }
    }

    public sealed record LoadedModule(ModuleManifest Manifest, IModule Instance, AssemblyLoadContext LoadContext);

    private enum VisitState
    {
        Visiting,
        Visited
    }
}
