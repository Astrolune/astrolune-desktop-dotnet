using Astrolune.Media.Module.Services;
using Astrolune.Sdk.Modules;
using Astrolune.Sdk.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Astrolune.Media.Module;

[Module("Astrolune.Media.Module", Version = "1.0.0", Author = "Astrolune")]
public sealed class MediaModule : IModule, IModuleHealthCheck
{
    public void Register(IServiceCollection services)
    {
        services.AddSingleton<CaptureService>();
        services.AddSingleton<ICaptureService>(sp => sp.GetRequiredService<CaptureService>());
        services.AddSingleton<MediaService>();
        services.AddSingleton<IMediaService>(sp => sp.GetRequiredService<MediaService>());
        services.AddSingleton<MediaProbe>();
        services.AddSingleton<IMediaProbe>(sp => sp.GetRequiredService<MediaProbe>());
    }

    public void Initialize()
    {
    }

    public void Shutdown()
    {
    }

    public Task<ModuleHealthResult> CheckAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(new ModuleHealthResult
        {
            ModuleId = "Astrolune.Media.Module",
            Status = ModuleHealthStatus.Healthy,
            Message = "Media module is healthy."
        });
}
