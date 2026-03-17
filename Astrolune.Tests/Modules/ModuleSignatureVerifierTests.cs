using Astrolune.Desktop.Modules;

namespace Astrolune.Tests.Modules;

public sealed class ModuleSignatureVerifierTests
{
    [Fact]
    public void Verify_InvalidSignature_ReturnsFalse()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        var manifestPath = Path.Combine(tempDir, "module.manifest.json");
        var dllPath = typeof(ModuleSignatureVerifier).Assembly.Location;
        var sigPath = Path.Combine(tempDir, "module.sig");

        File.WriteAllText(manifestPath, """
        {
          "id": "Astrolune.Core.Module",
          "name": "Astrolune Core Module",
          "version": "1.0.0",
          "author": "Astrolune",
          "description": "Core module",
          "category": "core",
          "permissions": [],
          "dependencies": [],
          "entryPoint": "Astrolune.Core.Module.CoreModule",
          "minHostVersion": "1.0.0"
        }
        """);

        File.WriteAllText(sigPath, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==");

        var verifier = new ModuleSignatureVerifier();
        var result = verifier.Verify(manifestPath, dllPath, sigPath, out var reason);

        Assert.NotEqual(ModuleSignatureCheck.Valid, result);
        Assert.False(string.IsNullOrWhiteSpace(reason));
    }
}
