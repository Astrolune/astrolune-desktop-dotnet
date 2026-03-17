using Astrolune.Sdk.Services;

namespace Astrolune.Core.Module.Services;

public interface IAuthService
{
    Task BeginLoginAsync(CancellationToken cancellationToken = default);
}

public interface IAccountService
{
    Task LoadCurrentAsync(CancellationToken cancellationToken = default);
}

public interface IGuildService
{
    Task RefreshAsync(CancellationToken cancellationToken = default);
}

public interface IChannelService
{
    Task RefreshAsync(CancellationToken cancellationToken = default);
}

public interface IMessageService
{
    Task SendAsync(string channelId, string content, CancellationToken cancellationToken = default);
}

public interface IScreenShareService
{
    Task StartAsync(CancellationToken cancellationToken = default);
    Task StopAsync(CancellationToken cancellationToken = default);
}

public interface IVoiceService
{
    Task ConnectAsync(CancellationToken cancellationToken = default);
    Task DisconnectAsync(CancellationToken cancellationToken = default);
}

public interface INotificationService
{
    Task NotifyAsync(string title, string message, CancellationToken cancellationToken = default);
}

public interface ISettingsService
{
    Task LoadAsync(CancellationToken cancellationToken = default);
}
