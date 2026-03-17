using Astrolune.Desktop.Modules;
using Astrolune.Sdk.Modules;

namespace Astrolune.Tests.Modules;

public sealed class ModulePermissionServiceTests
{
    [Fact]
    public async Task EnsurePermissions_StoresGrantedPermissions()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        var path = Path.Combine(tempDir, "permissions.dat");

        var store = new ModulePermissionStore(path);
        var prompt = new StubPrompt();
        var service = new ModulePermissionService(store, prompt);

        var manifest = new ModuleManifest
        {
            Id = "Astrolune.Core.Module",
            Name = "Astrolune Core Module",
            Permissions = new[] { "network", "screen" },
            EntryPoint = "Astrolune.Core.Module.CoreModule"
        };

        var granted = await service.EnsurePermissionsAsync(manifest);

        Assert.True(granted);
        var stored = store.GetPermissions(manifest.Id);
        Assert.Contains("network", stored, StringComparer.OrdinalIgnoreCase);
        Assert.Contains("screen", stored, StringComparer.OrdinalIgnoreCase);
        Assert.True(prompt.WasCalled);
    }

    private sealed class StubPrompt : IModuleUserPrompt
    {
        public bool WasCalled { get; private set; }

        public bool ConfirmUnsignedModule(ModuleManifest manifest) => true;

        public bool RequestPermissions(ModuleManifest manifest, IReadOnlyCollection<string> permissions)
        {
            WasCalled = true;
            return true;
        }

        public void NotifyUpdateReady(ModuleManifest manifest, Version version)
        {
        }
    }
}
