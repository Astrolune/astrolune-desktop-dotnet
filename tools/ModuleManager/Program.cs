using System.Diagnostics;
using System.Reflection;
using System.Runtime.Loader;
using Astrolune.Sdk.Modules;
using Astrolune.Desktop.Modules;
using Microsoft.Extensions.Logging.Abstractions;

if (args.Length == 0 || args[0] is "-h" or "--help")
{
    PrintUsage();
    return 1;
}

var command = args[0].ToLowerInvariant();
var argSet = new HashSet<string>(args.Skip(1), StringComparer.OrdinalIgnoreCase);
var options = ParseArgs(args.Skip(1).ToArray());
var modulesRoot = ResolveModulesRoot(options);

return command switch
{
    "list" => ListModules(modulesRoot),
    "info" => ShowInfo(modulesRoot, options),
    "verify" => VerifyModule(modulesRoot, options),
    "update" => await UpdateModulesAsync(modulesRoot, options, argSet),
    "apply" => ApplyUpdate(modulesRoot, options),
    _ => PrintUsage()
};

static int PrintUsage()
{
    Console.WriteLine("ModuleManager CLI");
    Console.WriteLine("Commands:");
    Console.WriteLine("  list");
    Console.WriteLine("  info --module <id>");
    Console.WriteLine("  verify --module <id>");
    Console.WriteLine("  update --module <id>");
    Console.WriteLine("  update --all");
    Console.WriteLine("  apply --module <id>");
    Console.WriteLine("Options:");
    Console.WriteLine("  --root <path> (optional modules root)");
    return 1;
}

static Dictionary<string, string> ParseArgs(string[] args)
{
    var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    for (var i = 0; i < args.Length; i++)
    {
        var key = args[i];
        if (!key.StartsWith("--", StringComparison.Ordinal))
        {
            continue;
        }

        if (i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal))
        {
            result[key] = args[i + 1];
            i++;
        }
        else
        {
            result[key] = string.Empty;
        }
    }

    return result;
}

static string ResolveModulesRoot(Dictionary<string, string> options)
{
    if (options.TryGetValue("--root", out var root) && !string.IsNullOrWhiteSpace(root))
    {
        return root;
    }

    var cwd = Directory.GetCurrentDirectory();
    var candidate = Path.Combine(cwd, "modules");
    return Directory.Exists(candidate) ? candidate : cwd;
}

static int ListModules(string modulesRoot)
{
    if (!Directory.Exists(modulesRoot))
    {
        Console.Error.WriteLine($"Modules root not found: {modulesRoot}");
        return 1;
    }

    var verifier = new ModuleSignatureVerifier();
    var manifests = LoadManifests(modulesRoot);
    Console.WriteLine("ID\tVersion\tAuthor\tStatus\tSignature\tPendingUpdate");

    foreach (var (id, manifest, moduleDir) in manifests)
    {
        var dllPath = Path.Combine(moduleDir, $"{manifest.Id}.dll");
        var sigPath = Path.Combine(moduleDir, "module.sig");
        var pending = Directory.Exists(Path.Combine(moduleDir, ".pending"));
        var sigCheck = verifier.Verify(Path.Combine(moduleDir, "module.manifest.json"), dllPath, sigPath, out _);
        var signatureLabel = sigCheck switch
        {
            ModuleSignatureCheck.Valid => "Valid",
            ModuleSignatureCheck.Missing => "Missing",
            ModuleSignatureCheck.Invalid => "Invalid",
            _ => "Error"
        };

        var status = pending ? ModuleStatus.PendingUpdate
            : sigCheck == ModuleSignatureCheck.Missing ? ModuleStatus.Unofficial
            : sigCheck == ModuleSignatureCheck.Valid ? ModuleStatus.Loaded
            : ModuleStatus.Failed;

        Console.WriteLine($"{id}\t{manifest.Version}\t{manifest.Author}\t{status}\t{signatureLabel}\t{pending}");
    }

    return 0;
}

static int ShowInfo(string modulesRoot, Dictionary<string, string> options)
{
    if (!options.TryGetValue("--module", out var id) || string.IsNullOrWhiteSpace(id))
    {
        return PrintUsage();
    }

    var manifestPath = Path.Combine(modulesRoot, id, "module.manifest.json");
    if (!File.Exists(manifestPath))
    {
        Console.Error.WriteLine("Manifest not found.");
        return 1;
    }

    Console.WriteLine(File.ReadAllText(manifestPath));
    return 0;
}

static int VerifyModule(string modulesRoot, Dictionary<string, string> options)
{
    if (!options.TryGetValue("--module", out var id) || string.IsNullOrWhiteSpace(id))
    {
        return PrintUsage();
    }

    var modulePath = Path.Combine(modulesRoot, id);
    var manifestPath = Path.Combine(modulePath, "module.manifest.json");
    if (!File.Exists(manifestPath))
    {
        Console.Error.WriteLine("Manifest not found.");
        return 1;
    }

    ModuleManifest manifest;
    try
    {
        manifest = ModuleManifest.Load(manifestPath);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Manifest parse failed: {ex.Message}");
        return 1;
    }

    var hostVersion = ResolveHostVersion(modulesRoot) ?? new Version(1, 0, 0, 0);
    var sdkVersion = typeof(IModule).Assembly.GetName().Version ?? new Version(1, 0, 0, 0);

    var errors = ModuleManifestValidator.Validate(manifest);
    if (errors.Count > 0)
    {
        Console.Error.WriteLine($"Manifest invalid: {string.Join("; ", errors)}");
        return 1;
    }

    if (manifest.ParsedMinHostVersion is null || manifest.ParsedMinHostVersion > hostVersion)
    {
        Console.Error.WriteLine($"Requires host version {manifest.MinHostVersion}.");
        return 1;
    }

    if (manifest.ParsedMinSdkVersion is null || manifest.ParsedMinSdkVersion > sdkVersion)
    {
        Console.Error.WriteLine($"Requires SDK version {manifest.MinSdkVersion}.");
        return 1;
    }

    if (!VerifyDependencies(modulesRoot, manifest))
    {
        return 1;
    }

    var dllPath = Path.Combine(modulePath, $"{manifest.Id}.dll");
    if (!File.Exists(dllPath))
    {
        Console.Error.WriteLine("Module dll not found.");
        return 1;
    }

    var verifier = new ModuleSignatureVerifier();
    var sigPath = Path.Combine(modulePath, "module.sig");
    var sigCheck = verifier.Verify(manifestPath, dllPath, sigPath, out var sigReason);
    if (sigCheck == ModuleSignatureCheck.Missing)
    {
        Console.WriteLine("Signature missing.");
        Console.Write("Continue anyway? [y/N]: ");
        var input = Console.ReadLine();
        if (!string.Equals(input, "y", StringComparison.OrdinalIgnoreCase))
        {
            return 2;
        }

        Console.WriteLine("Module marked as unofficial.");
    }
    else if (sigCheck is ModuleSignatureCheck.Invalid or ModuleSignatureCheck.Error)
    {
        Console.Error.WriteLine($"Signature invalid: {sigReason}");
        return 1;
    }

    var unknownPermissions = manifest.Permissions.Where(permission => !ModulePermissions.IsKnown(permission)).ToList();
    if (unknownPermissions.Count > 0)
    {
        Console.Error.WriteLine($"Unknown permissions: {string.Join(", ", unknownPermissions)}");
        return 1;
    }

    var assemblyName = AssemblyName.GetAssemblyName(dllPath);
    if (!string.Equals(assemblyName.Name, manifest.Id, StringComparison.OrdinalIgnoreCase))
    {
        Console.Error.WriteLine("Assembly name does not match manifest id.");
        return 1;
    }

    if (!VerifyEntryPoint(dllPath, manifest.EntryPoint))
    {
        Console.Error.WriteLine("Entry point does not implement IModule.");
        return 1;
    }

    Console.WriteLine("Module verification succeeded.");
    return 0;
}

static async Task<int> UpdateModulesAsync(string modulesRoot, Dictionary<string, string> options, HashSet<string> argSet)
{
    if (!Directory.Exists(modulesRoot))
    {
        Console.Error.WriteLine($"Modules root not found: {modulesRoot}");
        return 1;
    }

    var manifests = LoadManifests(modulesRoot).Select(item => item.Manifest).ToList();
    if (manifests.Count == 0)
    {
        Console.WriteLine("No modules found.");
        return 0;
    }

    if (argSet.Contains("--all") == false && (!options.TryGetValue("--module", out var id) || string.IsNullOrWhiteSpace(id)))
    {
        return PrintUsage();
    }

    if (!argSet.Contains("--all"))
    {
        manifests = manifests.Where(manifest => string.Equals(manifest.Id, options["--module"], StringComparison.OrdinalIgnoreCase)).ToList();
    }

    var registry = new ModuleRegistry();
    var prompt = new ConsoleModuleUserPrompt();
    var updateStatePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Astrolune", "module-updates.json");
    var updateState = new ModuleUpdateStateStore(updateStatePath);
    var loaderOptions = new ModuleLoaderOptions
    {
        ModulesRoot = modulesRoot,
        HostVersion = ResolveHostVersion(modulesRoot) ?? new Version(1, 0, 0, 0),
        SdkVersion = typeof(IModule).Assembly.GetName().Version ?? new Version(1, 0, 0, 0)
    };
    var updateOptions = new ModuleUpdateOptions
    {
        IsEnabled = true,
        CheckInterval = TimeSpan.Zero,
        StatePath = updateStatePath
    };

    var updater = new ModuleUpdater(
        updateOptions,
        loaderOptions,
        registry,
        new ModuleSignatureVerifier(),
        prompt,
        updateState,
        NullLogger<ModuleUpdater>.Instance);

    var progress = new Progress<ModuleUpdateProgress>(p =>
    {
        Console.WriteLine($"{p.ModuleId}: {p.Stage} {p.Detail}".Trim());
    });

    await updater.RunUpdateCheckAsync(manifests, progress, CancellationToken.None).ConfigureAwait(false);
    return 0;
}

static int ApplyUpdate(string modulesRoot, Dictionary<string, string> options)
{
    if (!options.TryGetValue("--module", out var id) || string.IsNullOrWhiteSpace(id))
    {
        return PrintUsage();
    }

    var moduleDir = Path.Combine(modulesRoot, id);
    var pendingDir = Path.Combine(moduleDir, ".pending");
    if (!Directory.Exists(pendingDir))
    {
        Console.WriteLine("No pending update found.");
        return 0;
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
        // Ignore cleanup errors.
    }

    Console.WriteLine("Pending update applied.");
    return 0;
}

static Version? ResolveHostVersion(string modulesRoot)
{
    try
    {
        var parent = Directory.GetParent(modulesRoot)?.FullName;
        if (string.IsNullOrWhiteSpace(parent))
        {
            return null;
        }

        var hostExe = Path.Combine(parent, "Astrolune.Desktop.exe");
        if (!File.Exists(hostExe))
        {
            return null;
        }

        return AssemblyName.GetAssemblyName(hostExe).Version;
    }
    catch
    {
        return null;
    }
}

static List<(string Id, ModuleManifest Manifest, string ModuleDir)> LoadManifests(string modulesRoot)
{
    var result = new List<(string, ModuleManifest, string)>();
    if (!Directory.Exists(modulesRoot))
    {
        return result;
    }

    foreach (var directory in Directory.GetDirectories(modulesRoot))
    {
        var manifestPath = Path.Combine(directory, "module.manifest.json");
        if (!File.Exists(manifestPath))
        {
            continue;
        }

        try
        {
            var manifest = ModuleManifest.Load(manifestPath);
            result.Add((manifest.Id, manifest, directory));
        }
        catch
        {
            // Ignore malformed manifests.
        }
    }

    return result;
}

static bool VerifyDependencies(string modulesRoot, ModuleManifest manifest)
{
    if (manifest.Dependencies.Count == 0)
    {
        return true;
    }

    var manifests = LoadManifests(modulesRoot).ToDictionary(item => item.Id, item => item.Manifest, StringComparer.OrdinalIgnoreCase);
    foreach (var dependency in manifest.Dependencies)
    {
        if (!manifests.TryGetValue(dependency.Id, out var depManifest))
        {
            Console.Error.WriteLine($"Missing dependency {dependency.Id}.");
            return false;
        }

        if (!IsVersionSatisfied(dependency, depManifest))
        {
            Console.Error.WriteLine($"Dependency {dependency.Id} does not satisfy version {dependency.Version}.");
            return false;
        }
    }

    return true;
}

static bool IsVersionSatisfied(ModuleDependency dependency, ModuleManifest manifest)
{
    var required = dependency.ParsedSemanticVersion;
    var available = manifest.ParsedSemanticVersion;
    if (required is null || available is null)
    {
        return true;
    }

    return available.CompareTo(required) >= 0;
}

static bool VerifyEntryPoint(string dllPath, string entryPoint)
{
    var context = new AssemblyLoadContext("ModuleManagerInspection", isCollectible: true);
    try
    {
        var assembly = context.LoadFromAssemblyPath(dllPath);
        var type = assembly.GetType(entryPoint, throwOnError: false, ignoreCase: false);
        return type is not null && typeof(IModule).IsAssignableFrom(type);
    }
    finally
    {
        context.Unload();
    }
}

sealed class ConsoleModuleUserPrompt : IModuleUserPrompt
{
    public bool ConfirmUnsignedModule(ModuleManifest manifest)
    {
        Console.WriteLine($"Module '{manifest.Name}' is not officially verified.");
        Console.Write("Continue anyway? [y/N]: ");
        var input = Console.ReadLine();
        return string.Equals(input, "y", StringComparison.OrdinalIgnoreCase);
    }

    public bool RequestPermissions(ModuleManifest manifest, IReadOnlyCollection<string> permissions)
    {
        if (permissions.Count == 0)
        {
            return true;
        }

        Console.WriteLine($"Module '{manifest.Name}' requests permissions: {string.Join(", ", permissions)}");
        Console.Write("Allow? [y/N]: ");
        var input = Console.ReadLine();
        return string.Equals(input, "y", StringComparison.OrdinalIgnoreCase);
    }

    public void NotifyUpdateReady(ModuleManifest manifest, Version version)
    {
        Console.WriteLine($"Update for '{manifest.Name}' staged ({version}). Restart to apply.");
    }
}
