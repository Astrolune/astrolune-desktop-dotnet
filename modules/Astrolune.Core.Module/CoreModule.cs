using Astrolune.Sdk.Modules;
using Astrolune.Core.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Astrolune.Core.Module;

[Module("Astrolune.Core.Module", Version = "1.0.0", Author = "Astrolune")]
public sealed class CoreModule : IModule, IModuleHealthCheck
{
    /// <inheritdoc />
    public void Register(IServiceCollection services)
    {
        // Core services
        services.AddSingleton<EventDispatcher>();
        services.AddSingleton<IEventDispatcher>(sp => sp.GetRequiredService<EventDispatcher>());
        services.AddSingleton<IEventDispatcherHost>(sp => sp.GetRequiredService<EventDispatcher>());
        services.AddSingleton<KeyringService>();
        services.AddSingleton<CoreDataStore>();

        // Application services
        services.AddSingleton<IAuthService, AuthService>();
        services.AddSingleton<IAccountService, AccountService>();
        services.AddSingleton<IGuildService, GuildService>();
        services.AddSingleton<IChannelService, ChannelService>();
        services.AddSingleton<IMessageService, MessageService>();
        services.AddSingleton<IScreenShareService, ScreenShareService>();
        services.AddSingleton<IVoiceService, VoiceService>();
        services.AddSingleton<INotificationService, NotificationService>();
        services.AddSingleton<ISettingsService, SettingsService>();
    }

    /// <inheritdoc />
    public void Initialize()
    {
    }

    /// <inheritdoc />
    public void Shutdown()
    {
    }

    /// <inheritdoc />
    public Task<ModuleHealthResult> CheckAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(new ModuleHealthResult
        {
            ModuleId = "Astrolune.Core.Module",
            Status = ModuleHealthStatus.Healthy,
            Message = "Core module is healthy."
        });
}
