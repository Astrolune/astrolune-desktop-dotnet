using System.Text.Json;
using Astrolune.Sdk.Services;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace Astrolune.Desktop;

public sealed class WebViewBridge
{
    private readonly BridgeCommandRouter _router;
    private readonly IEventDispatcherHost _dispatcherHost;
    private readonly IEventDispatcher _dispatcher;
    private readonly AuthCallbackManager _authCallbacks;
    private readonly JsonSerializerOptions _jsonOptions;
    private WebView2? _webView;
    private CoreWebView2? _core;

    public WebViewBridge(
        BridgeCommandRouter router,
        IEventDispatcherHost dispatcherHost,
        IEventDispatcher dispatcher,
        AuthCallbackManager authCallbacks)
    {
        _router = router;
        _dispatcherHost = dispatcherHost;
        _dispatcher = dispatcher;
        _authCallbacks = authCallbacks;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };
    }

    public async Task InitializeAsync(WebView2 webView, WebViewHostOptions options)
    {
        _webView = webView;
        await webView.EnsureCoreWebView2Async().ConfigureAwait(true);
        _core = webView.CoreWebView2;
        _core.Settings.AreDefaultContextMenusEnabled = false;
        _core.Settings.AreDevToolsEnabled = true;
        _core.Settings.IsZoomControlEnabled = false;
        var backgroundProperty = _core.GetType().GetProperty("DefaultBackgroundColor");
        if (backgroundProperty?.CanWrite == true)
        {
            backgroundProperty.SetValue(_core, System.Drawing.Color.Transparent);
        }
        _core.WebMessageReceived += OnWebMessageReceived;

        _dispatcherHost.AttachSink(EmitAsync);
        await _authCallbacks.FlushAsync(_dispatcher).ConfigureAwait(true);

        if (options.UseDevServer)
        {
            _core.Navigate(options.DevServerUrl);
            return;
        }

        _core.SetVirtualHostNameToFolderMapping(
            "app",
            options.FrontendFolder,
            CoreWebView2HostResourceAccessKind.Allow);
        _core.Navigate("https://app/index.html");
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (_webView is null || _core is null)
        {
            return;
        }

        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            var root = doc.RootElement;
            var id = root.TryGetProperty("id", out var idElement) ? idElement.GetString() : null;
            var cmd = root.TryGetProperty("cmd", out var cmdElement) ? cmdElement.GetString() : null;
            var payload = root.TryGetProperty("payload", out var payloadElement) ? payloadElement : (JsonElement?)null;

            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(cmd))
            {
                return;
            }

            object? result = null;
            string? error = null;

            try
            {
                result = await _router.HandleAsync(cmd, payload).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                error = ex.Message;
            }

            await SendResponseAsync(id, result, error).ConfigureAwait(false);
        }
        catch
        {
            // Swallow malformed messages to keep the bridge resilient.
        }
    }

    private Task EmitAsync(string eventName, object payload, CancellationToken cancellationToken)
    {
        if (_webView is null || _core is null)
        {
            return Task.CompletedTask;
        }

        var message = new
        {
            type = "event",
            @event = eventName,
            payload
        };

        var json = JsonSerializer.Serialize(message, _jsonOptions);
        return _webView.Dispatcher.InvokeAsync(() =>
        {
            _core.PostWebMessageAsJson(json);
        }, System.Windows.Threading.DispatcherPriority.Background, cancellationToken).Task;
    }

    private Task SendResponseAsync(string id, object? result, string? error)
    {
        if (_webView is null || _core is null)
        {
            return Task.CompletedTask;
        }

        var message = new
        {
            id,
            result,
            error
        };

        var json = JsonSerializer.Serialize(message, _jsonOptions);
        return _webView.Dispatcher.InvokeAsync(() =>
        {
            _core.PostWebMessageAsJson(json);
        }).Task;
    }
}
