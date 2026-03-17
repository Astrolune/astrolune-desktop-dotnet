using Astrolune.Desktop.Modules;
using Astrolune.Sdk.Modules;

namespace Astrolune.Tests.Modules;

public sealed class ModuleRegistryTests
{
    [Fact]
    public void UpdateHealth_SetsDegradedState()
    {
        var manifest = new ModuleManifest
        {
            Id = "Astrolune.Core.Module",
            Name = "Astrolune Core Module",
            Version = "1.0.0",
            EntryPoint = "Astrolune.Core.Module.CoreModule"
        };

        var registry = new ModuleRegistry();
        registry.UpdateStatus(manifest, ModuleStatus.Loaded);
        registry.UpdateHealth(manifest, new ModuleHealthResult
        {
            ModuleId = manifest.Id,
            Status = ModuleHealthStatus.Warning,
            Message = "Slow response"
        });

        var info = registry.Get(manifest.Id);
        Assert.NotNull(info);
        Assert.True(info!.IsDegraded);
        Assert.Equal("Slow response", info.Error);
    }
}
