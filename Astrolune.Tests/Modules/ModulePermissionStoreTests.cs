using Astrolune.Desktop.Modules;

namespace Astrolune.Tests.Modules;

public sealed class ModulePermissionStoreTests
{
    [Fact]
    public void GrantAndLoad_RoundTripsPermissions()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        var path = Path.Combine(tempDir, "permissions.dat");

        var store = new ModulePermissionStore(path);
        store.GrantPermissions("Astrolune.Core.Module", new[] { "network", "microphone" });

        var reloaded = new ModulePermissionStore(path);
        var permissions = reloaded.GetPermissions("Astrolune.Core.Module");

        Assert.Contains("network", permissions, StringComparer.OrdinalIgnoreCase);
        Assert.Contains("microphone", permissions, StringComparer.OrdinalIgnoreCase);
    }
}
