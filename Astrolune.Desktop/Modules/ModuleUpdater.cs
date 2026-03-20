using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Reflection;
using System.Runtime.Loader;
using System.IO.Compression;
using System.Text.Json;
using System.Text.Json.Serialization;
using Astrolune.Sdk.Modules;
using Microsoft.Extensions.Logging;

namespace Astrolune.Desktop.Modules;

public sealed class ModuleUpdater
{
    private readonly ModuleUpdateOptions _options;
    private readonly ModuleLoaderOptions _loaderOptions;
    private readonly ModuleRegistry _registry;
    private readonly ModuleSignatureVerifier _signatureVerifier;
    private readonly IModuleUserPrompt _prompt;
    private readonly ModuleUpdateStateStore _state;
    private readonly HttpClient _httpClient;
    private readonly ILogger<ModuleUpdater> _logger;

    public ModuleUpdater(
        ModuleUpdateOptions options,
        ModuleLoaderOptions loaderOptions,
        ModuleRegistry registry,
        ModuleSignatureVerifier signatureVerifier,
        IModuleUserPrompt prompt,
        ModuleUpdateStateStore state,
        ILogger<ModuleUpdater> logger)
    {
        _options = options;
        _loaderOptions = loaderOptions;
        _registry = registry;
        _signatureVerifier = signatureVerifier;
        _prompt = prompt;
        _state = state;
        _logger = logger;
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("Astrolune", "1.0"));
    }

    public async Task RunUpdateCheckAsync(
        IReadOnlyList<ModuleManifest> manifests,
        IProgress<ModuleUpdateProgress>? progress,
        CancellationToken cancellationToken)
    {
        if (!_options.IsEnabled)
        {
            _logger.LogInformation("Module updates are disabled.");
            return;
        }

        var manifestLookup = manifests.ToDictionary(m => m.Id, StringComparer.OrdinalIgnoreCase);
        var throttler = new SemaphoreSlim(Math.Max(1, _options.MaxParallelRequests));
        var tasks = new List<Task>();

        foreach (var manifest in manifests)
        {
            tasks.Add(Task.Run(async () =>
            {
                await throttler.WaitAsync(cancellationToken).ConfigureAwait(false);
                try
                {
                    await CheckModuleAsync(manifest, manifestLookup, progress, cancellationToken).ConfigureAwait(false);
                }
                finally
                {
                    throttler.Release();
                }
            }, cancellationToken));
        }

        await Task.WhenAll(tasks).ConfigureAwait(false);
    }

    private async Task CheckModuleAsync(
        ModuleManifest manifest,
        IReadOnlyDictionary<string, ModuleManifest> manifestLookup,
        IProgress<ModuleUpdateProgress>? progress,
        CancellationToken cancellationToken)
    {
        progress?.Report(new ModuleUpdateProgress(manifest.Id, ModuleUpdateStage.Started, null));

        if (string.IsNullOrWhiteSpace(manifest.UpdateRepository))
        {
            progress?.Report(new ModuleUpdateProgress(manifest.Id, ModuleUpdateStage.Skipped, "No update repository."));
            return;
        }

        if (!_state.ShouldCheck(manifest.Id, _options.CheckInterval, DateTimeOffset.UtcNow))
        {
            progress?.Report(new ModuleUpdateProgress(manifest.Id, ModuleUpdateStage.Skipped, "Recently checked."));
            return;
        }

        _state.MarkChecked(manifest.Id, DateTimeOffset.UtcNow);

        if (!TryParseRepository(manifest.UpdateRepository, out var owner, out var repo))
        {
            _logger.LogWarning("Module {ModuleId} has invalid updateRepository '{Repo}'.", manifest.Id, manifest.UpdateRepository);
            progress?.Report(new ModuleUpdateProgress(manifest.Id, ModuleUpdateStage.Failed, "Invalid updateRepository."));
            return;
        }

        GitHubRelease? release;
        try
        {
            release = await GetLatestReleaseAsync(owner, repo, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(ex, "Module update check failed for {ModuleId}.", manifest.Id);
            progress?.Report(new ModuleUpdateProgress(manifest.Id, ModuleUpdateStage.Skipped, "Update check failed."));
            return;
        }

        if (release is null || string.IsNullOrWhiteSpace(release.TagName))
        {
            progress?.Report(new ModuleUpdateProgress(manifest.Id, ModuleUpdateStage.Skipped, "No release found."));
            return;
        }

        if (!TryParseReleaseVersion(manifest.Id, release.TagName, out var latestVersion))
        {
            progress?.Report(new ModuleUpdateProgress(manifest.Id, ModuleUpdateStage.Skipped, "Release tag did not match."));
            return;
        }

        if (manifest.ParsedSemanticVersion is null || latestVersion.CompareTo(manifest.ParsedSemanticVersion) <= 0)
        {
            progress?.Report(new ModuleUpdateProgress(manifest.Id, ModuleUpdateStage.Skipped, "No newer version."));
            return;
        }

        var staged = await StageUpdateAsync(manifest, latestVersion, release, manifestLookup, cancellationToken).ConfigureAwait(false);
        if (!staged)
        {
            progress?.Report(new ModuleUpdateProgress(manifest.Id, ModuleUpdateStage.Failed, "Staging failed."));
            return;
        }

        _registry.MarkPendingUpdate(manifest, latestVersion.ToVersion());
        _prompt.NotifyUpdateReady(manifest, latestVersion.ToVersion());
        progress?.Report(new ModuleUpdateProgress(manifest.Id, ModuleUpdateStage.Staged, latestVersion.ToString()));
    }

    private async Task<GitHubRelease?> GetLatestReleaseAsync(string owner, string repo, CancellationToken cancellationToken)
    {
        var url = $"https://api.github.com/repos/{owner}/{repo}/releases/latest";
        using var response = await _httpClient.GetAsync(url, cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        return await JsonSerializer.DeserializeAsync<GitHubRelease>(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    private async Task<bool> StageUpdateAsync(
        ModuleManifest currentManifest,
        SemanticVersion latestVersion,
        GitHubRelease release,
        IReadOnlyDictionary<string, ModuleManifest> manifestLookup,
        CancellationToken cancellationToken)
    {
        var tempRoot = Path.Combine(Path.GetTempPath(), "Astrolune", "module-updates", currentManifest.Id, Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempRoot);

        var downloadTasks = new List<Task>();
        var hasPackage = false;
        foreach (var asset in release.Assets)
        {
            if (string.IsNullOrWhiteSpace(asset.Name) || string.IsNullOrWhiteSpace(asset.DownloadUrl))
            {
                continue;
            }

            if (!IsSupportedAsset(asset.Name))
            {
                continue;
            }

            var destination = GetAssetDestination(tempRoot, asset.Name);
            var destinationDir = Path.GetDirectoryName(destination);
            if (!string.IsNullOrWhiteSpace(destinationDir))
            {
                Directory.CreateDirectory(destinationDir);
            }

            downloadTasks.Add(DownloadAssetAsync(asset.DownloadUrl, destination, cancellationToken));
            if (asset.Name.EndsWith(".nupkg", StringComparison.OrdinalIgnoreCase))
            {
                hasPackage = true;
            }
        }

        await Task.WhenAll(downloadTasks).ConfigureAwait(false);

        var filesToStage = new List<(string Source, string Relative)>();
        string manifestPath;
        string dllPath;
        string sigPath;

        if (hasPackage)
        {
            var packagePath = Directory.GetFiles(tempRoot, "*.nupkg", SearchOption.TopDirectoryOnly).FirstOrDefault();
            if (string.IsNullOrWhiteSpace(packagePath))
            {
                _logger.LogWarning("Module {ModuleId} update package not found.", currentManifest.Id);
                CleanupTemp(tempRoot);
                return false;
            }

            var extractRoot = Path.Combine(tempRoot, "package");
            Directory.CreateDirectory(extractRoot);
            ZipFile.ExtractToDirectory(packagePath, extractRoot, overwriteFiles: true);

            if (!TryResolvePackageArtifacts(extractRoot, currentManifest.Id, out manifestPath, out dllPath, out sigPath, out var configPath, out var resourceFiles))
            {
                _logger.LogWarning("Module {ModuleId} package is missing required artifacts.", currentManifest.Id);
                CleanupTemp(tempRoot);
                return false;
            }

            filesToStage.Add((manifestPath, "module.manifest.json"));
            filesToStage.Add((dllPath, $"{currentManifest.Id}.dll"));
            if (File.Exists(sigPath))
            {
                filesToStage.Add((sigPath, "module.sig"));
            }
            if (!string.IsNullOrWhiteSpace(configPath) && File.Exists(configPath))
            {
                filesToStage.Add((configPath, "module.config.json"));
            }

            foreach (var resource in resourceFiles)
            {
                filesToStage.Add(resource);
            }
        }
        else
        {
            manifestPath = Path.Combine(tempRoot, "module.manifest.json");
            dllPath = Path.Combine(tempRoot, $"{currentManifest.Id}.dll");
            sigPath = Path.Combine(tempRoot, "module.sig");
            var configPath = Path.Combine(tempRoot, "module.config.json");

            filesToStage.Add((manifestPath, "module.manifest.json"));
            filesToStage.Add((dllPath, $"{currentManifest.Id}.dll"));
            filesToStage.Add((sigPath, "module.sig"));
            if (File.Exists(configPath))
            {
                filesToStage.Add((configPath, "module.config.json"));
            }
        }

        if (!File.Exists(manifestPath) || !File.Exists(dllPath) || !File.Exists(sigPath))
        {
            _logger.LogWarning("Staged module {ModuleId} is missing required artifacts.", currentManifest.Id);
            CleanupTemp(tempRoot);
            return false;
        }

        ModuleManifest downloadedManifest;
        try
        {
            downloadedManifest = ModuleManifest.Load(manifestPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse downloaded manifest for {ModuleId}.", currentManifest.Id);
            CleanupTemp(tempRoot);
            return false;
        }

        if (!ValidateDownloadedModule(downloadedManifest, dllPath, manifestLookup, out var reason))
        {
            _logger.LogWarning("Downloaded module {ModuleId} failed validation: {Reason}", currentManifest.Id, reason);
            CleanupTemp(tempRoot);
            return false;
        }

        var signatureCheck = _signatureVerifier.Verify(manifestPath, dllPath, sigPath, out var sigReason);
        if (signatureCheck == ModuleSignatureCheck.Missing)
        {
            var shouldContinue = _prompt.ConfirmUnsignedModule(downloadedManifest);
            if (!shouldContinue)
            {
                CleanupTemp(tempRoot);
                return false;
            }
        }
        else if (signatureCheck != ModuleSignatureCheck.Valid)
        {
            _logger.LogWarning("Downloaded module {ModuleId} failed signature validation: {Reason}", currentManifest.Id, sigReason);
            CleanupTemp(tempRoot);
            return false;
        }

        var pendingRoot = Path.Combine(_loaderOptions.ModulesRoot, currentManifest.Id, ".pending");
        try
        {
            if (Directory.Exists(pendingRoot))
            {
                Directory.Delete(pendingRoot, recursive: true);
            }
        }
        catch
        {
            // Ignore cleanup errors.
        }

        Directory.CreateDirectory(pendingRoot);

        foreach (var (source, relative) in filesToStage.Distinct())
        {
            if (!File.Exists(source))
            {
                continue;
            }

            var destination = Path.Combine(pendingRoot, relative);
            var destinationDir = Path.GetDirectoryName(destination);
            if (!string.IsNullOrWhiteSpace(destinationDir))
            {
                Directory.CreateDirectory(destinationDir);
            }

            File.Copy(source, destination, overwrite: true);
        }

        CleanupTemp(tempRoot);
        return true;
    }

    private bool ValidateDownloadedModule(
        ModuleManifest manifest,
        string dllPath,
        IReadOnlyDictionary<string, ModuleManifest> manifestLookup,
        out string? reason)
    {
        reason = null;
        var errors = ModuleManifestValidator.Validate(manifest);
        if (errors.Count > 0)
        {
            reason = string.Join("; ", errors);
            return false;
        }

        if (manifest.ParsedMinHostVersion is null || manifest.ParsedMinHostVersion > _loaderOptions.HostVersion)
        {
            reason = "minHostVersion is higher than host.";
            return false;
        }

        if (manifest.ParsedMinSdkVersion is null || manifest.ParsedMinSdkVersion > _loaderOptions.SdkVersion)
        {
            reason = "minSdkVersion is higher than SDK.";
            return false;
        }

        foreach (var dependency in manifest.Dependencies)
        {
            if (!manifestLookup.TryGetValue(dependency.Id, out var dependencyManifest))
            {
                reason = $"Missing dependency {dependency.Id}.";
                return false;
            }

            if (!ModuleLoaderIsVersionSatisfied(dependency, dependencyManifest))
            {
                reason = $"Dependency {dependency.Id} does not satisfy version {dependency.Version}.";
                return false;
            }
        }

        var unknownPermissions = manifest.Permissions
            .Where(permission => !ModulePermissions.IsKnown(permission))
            .ToList();
        if (unknownPermissions.Count > 0)
        {
            reason = $"Unknown permissions: {string.Join(", ", unknownPermissions)}";
            return false;
        }

        try
        {
            var assemblyName = AssemblyName.GetAssemblyName(dllPath);
            if (!string.Equals(assemblyName.Name, manifest.Id, StringComparison.OrdinalIgnoreCase))
            {
                reason = "Assembly name does not match manifest id.";
                return false;
            }

            var loadContext = new AssemblyLoadContext("ModuleUpdateValidation", isCollectible: true);
            try
            {
                var assembly = loadContext.LoadFromAssemblyPath(dllPath);
                var type = assembly.GetType(manifest.EntryPoint, throwOnError: false, ignoreCase: false);
                if (type is null || !typeof(IModule).IsAssignableFrom(type))
                {
                    reason = "Entry point does not implement IModule.";
                    return false;
                }
            }
            finally
            {
                loadContext.Unload();
            }
        }
        catch (Exception ex)
        {
            reason = $"Assembly validation failed: {ex.Message}";
            return false;
        }

        return true;
    }

    private static bool ModuleLoaderIsVersionSatisfied(ModuleDependency dependency, ModuleManifest manifest)
    {
        var required = dependency.ParsedSemanticVersion;
        var available = manifest.ParsedSemanticVersion;
        if (required is null || available is null)
        {
            return true;
        }

        return available.CompareTo(required) >= 0;
    }

    private static bool IsSupportedAsset(string name)
    {
        if (name.Equals("module.manifest.json", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (name.Equals("module.sig", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (name.Equals("module.config.json", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (name.EndsWith(".dll", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (name.EndsWith(".nupkg", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return false;
    }

    private static string GetAssetDestination(string root, string assetName)
    {
        if (assetName.EndsWith(".resources.dll", StringComparison.OrdinalIgnoreCase))
        {
            var parts = assetName.Split('.', 2, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 2 && parts[0].Length <= 7)
            {
                return Path.Combine(root, "Localization", parts[0], assetName.Substring(parts[0].Length + 1));
            }
        }

        return Path.Combine(root, assetName);
    }

    private static bool TryResolvePackageArtifacts(
        string extractRoot,
        string moduleId,
        out string manifestPath,
        out string dllPath,
        out string sigPath,
        out string configPath,
        out List<(string Source, string Relative)> resourceFiles)
    {
        manifestPath = string.Empty;
        dllPath = string.Empty;
        sigPath = string.Empty;
        configPath = string.Empty;
        resourceFiles = new List<(string, string)>();

        var manifestCandidates = Directory.GetFiles(extractRoot, "module.manifest.json", SearchOption.AllDirectories);
        manifestPath = manifestCandidates
            .OrderBy(path => path.Contains($"{Path.DirectorySeparatorChar}contentFiles{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .FirstOrDefault() ?? string.Empty;

        var sigCandidates = Directory.GetFiles(extractRoot, "module.sig", SearchOption.AllDirectories);
        sigPath = sigCandidates
            .OrderBy(path => path.Contains($"{Path.DirectorySeparatorChar}contentFiles{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .FirstOrDefault() ?? string.Empty;

        var configCandidates = Directory.GetFiles(extractRoot, "module.config.json", SearchOption.AllDirectories);
        configPath = configCandidates
            .OrderBy(path => path.Contains($"{Path.DirectorySeparatorChar}contentFiles{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .FirstOrDefault() ?? string.Empty;

        var dllCandidates = Directory.GetFiles(extractRoot, $"{moduleId}.dll", SearchOption.AllDirectories)
            .Where(path => path.Contains($"{Path.DirectorySeparatorChar}lib{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase))
            .ToList();
        dllPath = dllCandidates.FirstOrDefault() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(manifestPath) || string.IsNullOrWhiteSpace(dllPath))
        {
            return false;
        }

        foreach (var resource in Directory.GetFiles(extractRoot, "*.resources.dll", SearchOption.AllDirectories))
        {
            var relative = GetResourceRelativePath(resource);
            if (!string.IsNullOrWhiteSpace(relative))
            {
                resourceFiles.Add((resource, relative));
            }
        }

        return true;
    }

    private static string? GetResourceRelativePath(string resourcePath)
    {
        var segments = resourcePath.Split(Path.DirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries);
        var libIndex = Array.FindIndex(segments, segment => segment.Equals("lib", StringComparison.OrdinalIgnoreCase));
        if (libIndex < 0 || libIndex + 2 >= segments.Length)
        {
            return null;
        }

        var culture = segments[libIndex + 2];
        var fileName = Path.GetFileName(resourcePath);
        return Path.Combine(culture, fileName);
    }

    private async Task DownloadAssetAsync(string url, string destination, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync(url, cancellationToken).ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        await using var file = File.Create(destination);
        await stream.CopyToAsync(file, cancellationToken).ConfigureAwait(false);
    }

    private static void CleanupTemp(string root)
    {
        try
        {
            Directory.Delete(root, recursive: true);
        }
        catch
        {
            // Best-effort cleanup.
        }
    }

    private static bool TryParseRepository(string value, out string owner, out string repo)
    {
        owner = string.Empty;
        repo = string.Empty;
        var parts = value.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2)
        {
            return false;
        }

        owner = parts[0];
        repo = parts[1];
        return !string.IsNullOrWhiteSpace(owner) && !string.IsNullOrWhiteSpace(repo);
    }

    private static bool TryParseReleaseVersion(string moduleId, string tag, out SemanticVersion version)
    {
        version = null!;
        
        // Поддержка форматов тегов:
        // module-core-v{version} -> для Astrolune.Core.Module
        // module-media-v{version} -> для Astrolune.Media.Module
        // module-{moduleId}-v{version} -> общий формат
        
        var moduleIdLower = moduleId.ToLowerInvariant();
        var expectedTagPrefix = moduleIdLower switch
        {
            "astrolune.core.module" => "module-core-v",
            "astrolune.media.module" => "module-media-v",
            "astrolune.auth.module" => "module-auth-v",
            _ => $"module-{moduleIdLower}-v"
        };
        
        if (!tag.StartsWith(expectedTagPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var versionText = tag.Substring(expectedTagPrefix.Length);
        if (!SemanticVersion.TryParse(versionText, out var parsed))
        {
            return false;
        }

        version = parsed!;
        return true;
    }

    private sealed class GitHubRelease
    {
        [JsonPropertyName("tag_name")]
        public string? TagName { get; init; }

        [JsonPropertyName("assets")]
        public List<GitHubAsset> Assets { get; init; } = new();
    }

    private sealed class GitHubAsset
    {
        [JsonPropertyName("name")]
        public string? Name { get; init; }

        [JsonPropertyName("browser_download_url")]
        public string? DownloadUrl { get; init; }
    }
}

public sealed record ModuleUpdateProgress(string ModuleId, ModuleUpdateStage Stage, string? Detail);

public enum ModuleUpdateStage
{
    Started,
    Skipped,
    Failed,
    Staged
}

internal static class SemanticVersionExtensions
{
    public static Version ToVersion(this SemanticVersion version)
        => new(version.Major, version.Minor, version.Patch);
}
