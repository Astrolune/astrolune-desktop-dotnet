using System.Reflection;
using System.Runtime.Loader;
using Astrolune.Sdk.Modules;
using NSec.Cryptography;

if (args.Length == 0 || args[0] is "-h" or "--help")
{
    PrintUsage();
    return 1;
}

var command = args[0].ToLowerInvariant();
var options = ParseArgs(args.Skip(1).ToArray());

return command switch
{
    "sign" => await SignAsync(options),
    "verify" => await VerifyAsync(options),
    _ => PrintUsage()
};

static int PrintUsage()
{
    Console.WriteLine("ModuleSigner CLI");
    Console.WriteLine("Commands:");
    Console.WriteLine("  sign --module <path> --key <privateKeyPath>");
    Console.WriteLine("  verify --module <path> [--host-version <version>] [--sdk-version <version>]");
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

        if (i + 1 < args.Length)
        {
            result[key] = args[i + 1];
            i++;
        }
    }

    return result;
}

static async Task<int> SignAsync(Dictionary<string, string> options)
{
    if (!options.TryGetValue("--module", out var modulePath) || string.IsNullOrWhiteSpace(modulePath) ||
        !options.TryGetValue("--key", out var keyPath) || string.IsNullOrWhiteSpace(keyPath))
    {
        return PrintUsage();
    }

    var manifestPath = Path.Combine(modulePath, "module.manifest.json");
    if (!File.Exists(manifestPath))
    {
        Console.Error.WriteLine("Manifest not found.");
        return 1;
    }

    var manifest = ModuleManifest.Load(manifestPath);
    var dllPath = Path.Combine(modulePath, $"{manifest.Id}.dll");
    if (!File.Exists(dllPath))
    {
        Console.Error.WriteLine("Module dll not found.");
        return 1;
    }

    var keyBase64 = (await File.ReadAllTextAsync(keyPath)).Trim();
    var privateKeySeed = Convert.FromBase64String(keyBase64);
    var algorithm = SignatureAlgorithm.Ed25519;
    var key = Key.Import(algorithm, privateKeySeed, KeyBlobFormat.RawPrivateKey);

    var payload = BuildPayload(manifestPath, dllPath);
    var signature = algorithm.Sign(key, payload);
    var signatureText = Convert.ToBase64String(signature);
    var sigPath = Path.Combine(modulePath, "module.sig");
    await File.WriteAllTextAsync(sigPath, signatureText);

    Console.WriteLine($"Signed {manifest.Id} -> {sigPath}");
    return 0;
}

static Task<int> VerifyAsync(Dictionary<string, string> options)
{
    if (!options.TryGetValue("--module", out var modulePath) || string.IsNullOrWhiteSpace(modulePath))
    {
        return Task.FromResult(PrintUsage());
    }

    var manifestPath = Path.Combine(modulePath, "module.manifest.json");
    if (!File.Exists(manifestPath))
    {
        Console.Error.WriteLine("Manifest not found.");
        return Task.FromResult(1);
    }

    ModuleManifest manifest;
    try
    {
        manifest = ModuleManifest.Load(manifestPath);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Manifest parse failed: {ex.Message}");
        return Task.FromResult(1);
    }

    var hostVersion = ParseVersionOption(options, "--host-version") ?? new Version(1, 0, 0, 0);
    var sdkVersion = ParseVersionOption(options, "--sdk-version") ?? new Version(1, 0, 0, 0);

    var errors = ValidateManifest(manifest);
    if (errors.Count > 0)
    {
        Console.Error.WriteLine($"Manifest invalid: {string.Join("; ", errors)}");
        return Task.FromResult(1);
    }

    if (manifest.ParsedMinHostVersion is null || manifest.ParsedMinHostVersion > hostVersion)
    {
        Console.Error.WriteLine($"Requires host version {manifest.MinHostVersion}.");
        return Task.FromResult(1);
    }

    if (manifest.ParsedMinSdkVersion is null || manifest.ParsedMinSdkVersion > sdkVersion)
    {
        Console.Error.WriteLine($"Requires SDK version {manifest.MinSdkVersion}.");
        return Task.FromResult(1);
    }

    var dllPath = Path.Combine(modulePath, $"{manifest.Id}.dll");
    if (!File.Exists(dllPath))
    {
        Console.Error.WriteLine("Module dll not found.");
        return Task.FromResult(1);
    }

    if (!VerifyDependencies(modulePath, manifest))
    {
        return Task.FromResult(1);
    }

    var sigPath = Path.Combine(modulePath, "module.sig");
    var sigCheck = VerifySignature(manifestPath, dllPath, sigPath, out var sigReason);
    if (sigCheck == ModuleSignatureCheck.Missing)
    {
        Console.WriteLine("Signature missing.");
        Console.Write("Continue anyway? [y/N]: ");
        var input = Console.ReadLine();
        if (!string.Equals(input, "y", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(2);
        }

        Console.WriteLine("Module marked as unofficial.");
    }
    else if (sigCheck != ModuleSignatureCheck.Valid)
    {
        Console.Error.WriteLine($"Signature invalid: {sigReason}");
        return Task.FromResult(1);
    }

    var unknownPermissions = manifest.Permissions.Where(permission => !ModulePermissions.IsKnown(permission)).ToList();
    if (unknownPermissions.Count > 0)
    {
        Console.Error.WriteLine($"Unknown permissions: {string.Join(", ", unknownPermissions)}");
        return Task.FromResult(1);
    }

    var assemblyName = AssemblyName.GetAssemblyName(dllPath);
    if (!string.Equals(assemblyName.Name, manifest.Id, StringComparison.OrdinalIgnoreCase))
    {
        Console.Error.WriteLine("Assembly name does not match manifest id.");
        return Task.FromResult(1);
    }

    if (!VerifyEntryPoint(dllPath, manifest.EntryPoint))
    {
        Console.Error.WriteLine("Entry point does not implement IModule.");
        return Task.FromResult(1);
    }

    Console.WriteLine("Module verification succeeded.");
    return Task.FromResult(0);
}

static Version? ParseVersionOption(Dictionary<string, string> options, string key)
{
    if (!options.TryGetValue(key, out var value))
    {
        return null;
    }

    return Version.TryParse(value, out var parsed) ? parsed : null;
}

static List<string> ValidateManifest(ModuleManifest manifest)
{
    var errors = new List<string>();

    if (string.IsNullOrWhiteSpace(manifest.Id))
    {
        errors.Add("id is required");
    }

    if (string.IsNullOrWhiteSpace(manifest.Name))
    {
        errors.Add("name is required");
    }

    if (string.IsNullOrWhiteSpace(manifest.Version) || !SemanticVersion.TryParse(manifest.Version, out _))
    {
        errors.Add("version is invalid");
    }

    if (string.IsNullOrWhiteSpace(manifest.Author))
    {
        errors.Add("author is required");
    }

    if (string.IsNullOrWhiteSpace(manifest.Description))
    {
        errors.Add("description is required");
    }

    if (string.IsNullOrWhiteSpace(manifest.Category))
    {
        errors.Add("category is required");
    }

    if (string.IsNullOrWhiteSpace(manifest.EntryPoint))
    {
        errors.Add("entryPoint is required");
    }

    if (string.IsNullOrWhiteSpace(manifest.MinHostVersion) || !Version.TryParse(manifest.MinHostVersion, out _))
    {
        errors.Add("minHostVersion is invalid");
    }

    if (string.IsNullOrWhiteSpace(manifest.MinSdkVersion) || !Version.TryParse(manifest.MinSdkVersion, out _))
    {
        errors.Add("minSdkVersion is invalid");
    }

    if (string.IsNullOrWhiteSpace(manifest.Signature))
    {
        errors.Add("signature is required");
    }

    if (string.IsNullOrWhiteSpace(manifest.UpdateRepository))
    {
        errors.Add("updateRepository is required");
    }

    foreach (var dependency in manifest.Dependencies)
    {
        if (string.IsNullOrWhiteSpace(dependency.Id))
        {
            errors.Add("dependency id is required");
        }

        if (string.IsNullOrWhiteSpace(dependency.Version) || !SemanticVersion.TryParse(dependency.Version, out _))
        {
            errors.Add($"dependency {dependency.Id} has invalid version");
        }
    }

    return errors;
}

static bool VerifyDependencies(string modulePath, ModuleManifest manifest)
{
    if (manifest.Dependencies.Count == 0)
    {
        return true;
    }

    var parent = Directory.GetParent(modulePath)?.FullName;
    if (string.IsNullOrWhiteSpace(parent) || !Directory.Exists(parent))
    {
        Console.Error.WriteLine("Unable to resolve module dependencies.");
        return false;
    }

    var manifests = new Dictionary<string, ModuleManifest>(StringComparer.OrdinalIgnoreCase);
    foreach (var directory in Directory.GetDirectories(parent))
    {
        var manifestPath = Path.Combine(directory, "module.manifest.json");
        if (!File.Exists(manifestPath))
        {
            continue;
        }

        try
        {
            var depManifest = ModuleManifest.Load(manifestPath);
            manifests[depManifest.Id] = depManifest;
        }
        catch
        {
            // Ignore malformed dependencies.
        }
    }

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

static ModuleSignatureCheck VerifySignature(string manifestPath, string dllPath, string sigPath, out string? reason)
{
    reason = null;

    if (!File.Exists(sigPath))
    {
        reason = "Signature file is missing.";
        return ModuleSignatureCheck.Missing;
    }

    try
    {
        var signatureText = File.ReadAllText(sigPath).Trim();
        var signature = Convert.FromBase64String(signatureText);
        var payload = BuildPayload(manifestPath, dllPath);
        var algorithm = SignatureAlgorithm.Ed25519;
        var publicKeyBytes = Convert.FromBase64String("11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=");
        var publicKey = PublicKey.Import(algorithm, publicKeyBytes, KeyBlobFormat.RawPublicKey);

        if (!algorithm.Verify(publicKey, payload, signature))
        {
            reason = "Signature is invalid.";
            return ModuleSignatureCheck.Invalid;
        }

        return ModuleSignatureCheck.Valid;
    }
    catch (Exception ex)
    {
        reason = ex.Message;
        return ModuleSignatureCheck.Error;
    }
}

static byte[] BuildPayload(string manifestPath, string dllPath)
{
    var manifestBytes = File.ReadAllBytes(manifestPath);
    var dllBytes = File.ReadAllBytes(dllPath);
    var manifestHash = System.Security.Cryptography.SHA256.HashData(manifestBytes);
    var dllHash = System.Security.Cryptography.SHA256.HashData(dllBytes);
    var payload = new byte[manifestHash.Length + dllHash.Length];
    Buffer.BlockCopy(dllHash, 0, payload, 0, dllHash.Length);
    Buffer.BlockCopy(manifestHash, 0, payload, dllHash.Length, manifestHash.Length);
    return payload;
}

static bool VerifyEntryPoint(string dllPath, string entryPoint)
{
    var context = new AssemblyLoadContext("ModuleSignerInspection", isCollectible: true);
    try
    {
        var assembly = context.LoadFromAssemblyPath(dllPath);
        var type = assembly.GetType(entryPoint, throwOnError: false, ignoreCase: false);
        if (type is null)
        {
            return false;
        }

        return typeof(IModule).IsAssignableFrom(type);
    }
    finally
    {
        context.Unload();
    }
}

enum ModuleSignatureCheck
{
    Valid,
    Missing,
    Invalid,
    Error
}
