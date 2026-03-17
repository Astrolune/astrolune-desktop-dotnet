using Astrolune.Sdk.Services;

namespace Astrolune.Core.Module.Services;

public sealed class AuthService : IAuthService
{
    private readonly IEventDispatcher _dispatcher;

    public AuthService(IEventDispatcher dispatcher)
    {
        _dispatcher = dispatcher;
    }

    public async Task BeginLoginAsync(CancellationToken cancellationToken = default)
    {
        await _dispatcher.EmitAsync("auth:login", new { status = "started" }, cancellationToken).ConfigureAwait(false);
        await _dispatcher.EmitAsync("auth:login", new { status = "ready" }, cancellationToken).ConfigureAwait(false);
    }
}

public sealed class AccountService : IAccountService
{
    private readonly CoreDataStore _store;
    private readonly IEventDispatcher _dispatcher;

    public AccountService(CoreDataStore store, IEventDispatcher dispatcher)
    {
        _store = store;
        _dispatcher = dispatcher;
    }

    public async Task LoadCurrentAsync(CancellationToken cancellationToken = default)
    {
        var profile = await _store.LoadAsync(
            "account.json",
            new AccountProfile("user-1", "Astrolune User", "offline"),
            cancellationToken).ConfigureAwait(false);

        await _dispatcher.EmitAsync("account:loaded", profile, cancellationToken).ConfigureAwait(false);
    }
}

public sealed class GuildService : IGuildService
{
    private readonly CoreDataStore _store;
    private readonly IEventDispatcher _dispatcher;

    public GuildService(CoreDataStore store, IEventDispatcher dispatcher)
    {
        _store = store;
        _dispatcher = dispatcher;
    }

    public async Task RefreshAsync(CancellationToken cancellationToken = default)
    {
        var guilds = await _store.LoadAsync(
            "guilds.json",
            new List<GuildSummary>
            {
                new("guild-1", "Astrolune HQ"),
                new("guild-2", "Creators")
            },
            cancellationToken).ConfigureAwait(false);

        await _dispatcher.EmitAsync("guilds:loaded", guilds, cancellationToken).ConfigureAwait(false);
    }
}

public sealed class ChannelService : IChannelService
{
    private readonly CoreDataStore _store;
    private readonly IEventDispatcher _dispatcher;

    public ChannelService(CoreDataStore store, IEventDispatcher dispatcher)
    {
        _store = store;
        _dispatcher = dispatcher;
    }

    public async Task RefreshAsync(CancellationToken cancellationToken = default)
    {
        var channels = await _store.LoadAsync(
            "channels.json",
            new List<ChannelSummary>
            {
                new("channel-1", "general", "guild-1"),
                new("channel-2", "announcements", "guild-1"),
                new("channel-3", "music", "guild-2")
            },
            cancellationToken).ConfigureAwait(false);

        await _dispatcher.EmitAsync("channels:loaded", channels, cancellationToken).ConfigureAwait(false);
    }
}

public sealed class MessageService : IMessageService
{
    private readonly CoreDataStore _store;
    private readonly IEventDispatcher _dispatcher;

    public MessageService(CoreDataStore store, IEventDispatcher dispatcher)
    {
        _store = store;
        _dispatcher = dispatcher;
    }

    public async Task SendAsync(string channelId, string content, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(channelId))
        {
            throw new ArgumentException("Channel id is required.", nameof(channelId));
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            return;
        }

        var payload = new MessagePayload(Guid.NewGuid().ToString("N"), channelId, content, DateTimeOffset.UtcNow);
        var key = $"messages-{channelId}.json";
        var messages = await _store.LoadAsync(key, new List<MessagePayload>(), cancellationToken).ConfigureAwait(false);
        messages.Add(payload);
        await _store.SaveAsync(key, messages, cancellationToken).ConfigureAwait(false);

        await _dispatcher.EmitAsync("messages:new", payload, cancellationToken).ConfigureAwait(false);
    }
}

public sealed class ScreenShareService : IScreenShareService
{
    private readonly ICaptureService _captureService;
    private readonly IEventDispatcher _dispatcher;
    private string? _sessionId;

    public ScreenShareService(ICaptureService captureService, IEventDispatcher dispatcher)
    {
        _captureService = captureService;
        _dispatcher = dispatcher;
    }

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        _sessionId = await _captureService.StartScreenCaptureAsync(new ScreenCaptureRequest(), cancellationToken)
            .ConfigureAwait(false);
        await _dispatcher.EmitAsync("screenshare:started", new { sessionId = _sessionId }, cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task StopAsync(CancellationToken cancellationToken = default)
    {
        await _captureService.StopScreenCaptureAsync(cancellationToken).ConfigureAwait(false);
        await _dispatcher.EmitAsync("screenshare:stopped", new { sessionId = _sessionId }, cancellationToken)
            .ConfigureAwait(false);
        _sessionId = null;
    }
}

public sealed class VoiceService : IVoiceService
{
    private readonly IMediaService _mediaService;
    private readonly CoreDataStore _store;
    private readonly IEventDispatcher _dispatcher;

    public VoiceService(IMediaService mediaService, CoreDataStore store, IEventDispatcher dispatcher)
    {
        _mediaService = mediaService;
        _store = store;
        _dispatcher = dispatcher;
    }

    public async Task ConnectAsync(CancellationToken cancellationToken = default)
    {
        var settings = await _store.LoadAsync(
            "voice.json",
            new VoiceSettings(string.Empty, string.Empty, null),
            cancellationToken).ConfigureAwait(false);

        if (string.IsNullOrWhiteSpace(settings.LivekitUrl) || string.IsNullOrWhiteSpace(settings.Token))
        {
            throw new InvalidOperationException("LiveKit configuration is missing. Populate voice.json with url and token.");
        }

        await _mediaService.ConnectLivekitAsync(new ConnectLivekitRequest
        {
            LivekitUrl = settings.LivekitUrl,
            Token = settings.Token
        }, cancellationToken).ConfigureAwait(false);

        await _mediaService.StartVoiceAsync(new StartVoiceRequest { InputDeviceId = settings.InputDeviceId }, cancellationToken)
            .ConfigureAwait(false);
        await _dispatcher.EmitAsync("voice:connected", new { status = "connected" }, cancellationToken).ConfigureAwait(false);
    }

    public async Task DisconnectAsync(CancellationToken cancellationToken = default)
    {
        await _mediaService.DisconnectLivekitAsync(cancellationToken).ConfigureAwait(false);
        await _dispatcher.EmitAsync("voice:disconnected", new { status = "disconnected" }, cancellationToken).ConfigureAwait(false);
    }
}

public sealed class NotificationService : INotificationService
{
    private readonly IEventDispatcher _dispatcher;

    public NotificationService(IEventDispatcher dispatcher)
    {
        _dispatcher = dispatcher;
    }

    public Task NotifyAsync(string title, string message, CancellationToken cancellationToken = default)
    {
        return _dispatcher.EmitAsync("notification", new { title, message }, cancellationToken);
    }
}

public sealed class SettingsService : ISettingsService
{
    private readonly CoreDataStore _store;
    private readonly IEventDispatcher _dispatcher;

    public SettingsService(CoreDataStore store, IEventDispatcher dispatcher)
    {
        _store = store;
        _dispatcher = dispatcher;
    }

    public async Task LoadAsync(CancellationToken cancellationToken = default)
    {
        var settings = await _store.LoadAsync(
            "settings.json",
            new SettingsPayload("dark", "en-US"),
            cancellationToken).ConfigureAwait(false);

        await _dispatcher.EmitAsync("settings:loaded", settings, cancellationToken).ConfigureAwait(false);
    }
}

public sealed record AccountProfile(string Id, string DisplayName, string Status);

public sealed record GuildSummary(string Id, string Name);

public sealed record ChannelSummary(string Id, string Name, string GuildId);

public sealed record MessagePayload(string Id, string ChannelId, string Content, DateTimeOffset Timestamp);

public sealed record SettingsPayload(string Theme, string Locale);

public sealed record VoiceSettings(string LivekitUrl, string Token, string? InputDeviceId);
