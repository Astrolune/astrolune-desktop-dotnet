using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows;
using Astrolune.Core.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Win32;

namespace Astrolune.Desktop;

public partial class App : Application
{
    private IHost? _host;
    private Mutex? _instanceMutex;
    private CancellationTokenSource? _deeplinkCts;
    private Task? _deeplinkServerTask;
    private AuthCallbackManager? _authCallbacks;

    private const string InstanceMutexName = "Astrolune.Desktop.SingleInstance";
    private const string DeepLinkPipeName = "Astrolune.Desktop.DeepLinkPipe";

    private async void OnStartup(object sender, StartupEventArgs e)
    {
        EnsureDevServer();

        if (!EnsureSingleInstance(e.Args))
        {
            Shutdown();
            return;
        }

        _host = Host.CreateDefaultBuilder()
            .ConfigureServices(services =>
            {
                services.AddSingleton<AuthClientLauncher>();
                services.AddSingleton<AuthCallbackManager>();
                services.AddSingleton<EventDispatcher>();
                services.AddSingleton<IEventDispatcher>(sp => sp.GetRequiredService<EventDispatcher>());
                services.AddSingleton<CaptureService>();
                services.AddSingleton<MediaService>();
                services.AddSingleton<KeyringService>();
                services.AddSingleton<MediaProbe>();
                services.AddSingleton<BridgeCommandRouter>();
                services.AddSingleton<WebViewBridge>();
                services.AddSingleton<MainWindow>();
                services.AddSingleton<SplashWindow>();
            })
            .Build();

        await _host.StartAsync().ConfigureAwait(false);

        _authCallbacks = _host.Services.GetRequiredService<AuthCallbackManager>();
        var authLauncher = _host.Services.GetRequiredService<AuthClientLauncher>();
        RegisterProtocolHandler(authLauncher.CallbackScheme);
        StartDeepLinkServer(authLauncher.CallbackScheme);
        ProcessDeepLinkArgs(e.Args, authLauncher.CallbackScheme);

        var splash = _host.Services.GetRequiredService<SplashWindow>();
        var main = _host.Services.GetRequiredService<MainWindow>();
        MainWindow = main;

        splash.Show();
        main.Hide();

        _ = Task.Run(async () =>
        {
            var probe = _host.Services.GetRequiredService<MediaProbe>();
            try
            {
                await probe.RunAsync().ConfigureAwait(false);
            }
            catch
            {
                // Startup probe errors are surfaced to the UI via events.
            }

            await Dispatcher.InvokeAsync(() =>
            {
                if (splash.IsVisible)
                {
                    splash.Close();
                }
                main.Show();
                main.Activate();
                ShutdownMode = ShutdownMode.OnMainWindowClose;
            });
        });
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        if (_deeplinkCts is not null)
        {
            _deeplinkCts.Cancel();
            if (_deeplinkServerTask is not null)
            {
                await _deeplinkServerTask.ConfigureAwait(false);
            }
        }

        if (_host is not null)
        {
            await _host.StopAsync().ConfigureAwait(false);
            _host.Dispose();
        }

        _instanceMutex?.ReleaseMutex();
        _instanceMutex?.Dispose();

        base.OnExit(e);
    }

    private static void EnsureDevServer()
    {
        var useDevServer = Debugger.IsAttached ||
                           string.Equals(Environment.GetEnvironmentVariable("ASTROLUNE_USE_DEVSERVER"), "1",
                               StringComparison.OrdinalIgnoreCase);

        if (!useDevServer)
        {
            return;
        }

        var devUrl = Environment.GetEnvironmentVariable("ASTROLUNE_DEV_URL") ?? "http://localhost:5173";
        if (Uri.TryCreate(devUrl, UriKind.Absolute, out var uri) && IsPortOpen(uri.Port))
        {
            return;
        }

        var frontendRoot = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..",
            "..",
            "..",
            "..",
            "frontend"));

        if (!Directory.Exists(frontendRoot))
        {
            return;
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = "/c npm run dev",
            WorkingDirectory = frontendRoot,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        Process.Start(startInfo);
    }

    private static bool IsPortOpen(int port)
    {
        try
        {
            using var client = new TcpClient();
            var task = client.ConnectAsync("127.0.0.1", port);
            return task.Wait(TimeSpan.FromMilliseconds(200));
        }
        catch
        {
            return false;
        }
    }

    private bool EnsureSingleInstance(string[] args)
    {
        _instanceMutex = new Mutex(true, InstanceMutexName, out var isNew);
        if (isNew)
        {
            return true;
        }

        SendDeepLinkToPrimary(args);
        return false;
    }

    private static void SendDeepLinkToPrimary(string[] args)
    {
        var uriArgument = args.FirstOrDefault(arg => arg.Contains("://", StringComparison.OrdinalIgnoreCase));
        if (string.IsNullOrWhiteSpace(uriArgument))
        {
            return;
        }

        for (var attempt = 0; attempt < 10; attempt++)
        {
            try
            {
                using var client = new NamedPipeClientStream(".", DeepLinkPipeName, PipeDirection.Out);
                client.Connect(200);
                using var writer = new StreamWriter(client, Encoding.UTF8, leaveOpen: true)
                {
                    AutoFlush = true
                };
                writer.WriteLine(uriArgument);
                return;
            }
            catch
            {
                Thread.Sleep(150);
            }
        }
    }

    private void StartDeepLinkServer(string callbackScheme)
    {
        _deeplinkCts = new CancellationTokenSource();
        _deeplinkServerTask = Task.Run(() => RunDeepLinkServerAsync(callbackScheme, _deeplinkCts.Token));
    }

    private async Task RunDeepLinkServerAsync(string callbackScheme, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            using var server = new NamedPipeServerStream(
                DeepLinkPipeName,
                PipeDirection.In,
                1,
                PipeTransmissionMode.Message,
                PipeOptions.Asynchronous);

            try
            {
                await server.WaitForConnectionAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            using var reader = new StreamReader(server, Encoding.UTF8, leaveOpen: true);
            var line = await reader.ReadLineAsync().ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(line))
            {
                HandleDeepLink(line, callbackScheme);
            }
        }
    }

    private void ProcessDeepLinkArgs(string[] args, string callbackScheme)
    {
        foreach (var arg in args)
        {
            if (!string.IsNullOrWhiteSpace(arg))
            {
                HandleDeepLink(arg, callbackScheme);
            }
        }
    }

    private void HandleDeepLink(string argument, string callbackScheme)
    {
        if (_authCallbacks is null)
        {
            return;
        }

        if (!Uri.TryCreate(argument, UriKind.Absolute, out var uri))
        {
            return;
        }

        if (!string.Equals(uri.Scheme, callbackScheme, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var query = ParseQuery(uri.Query);
        var error = ReadFirst(query, "error", "message");
        var accessToken = ReadFirst(query, "accessToken", "access_token", "AccessToken");
        var refreshToken = ReadFirst(query, "refreshToken", "refresh_token", "RefreshToken");

        if (string.IsNullOrWhiteSpace(accessToken) || string.IsNullOrWhiteSpace(refreshToken))
        {
            if (string.IsNullOrWhiteSpace(error))
            {
                error = "Auth callback did not include tokens.";
            }
        }

        _authCallbacks.Enqueue(new AuthCallbackPayload
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            Error = error
        });
    }

    private static Dictionary<string, string> ParseQuery(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var trimmed = query.TrimStart('?');
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return result;
        }

        foreach (var part in trimmed.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var pieces = part.Split('=', 2);
            var key = Uri.UnescapeDataString(pieces[0]);
            var value = pieces.Length > 1 ? Uri.UnescapeDataString(pieces[1]) : string.Empty;
            result[key] = value;
        }

        return result;
    }

    private static string? ReadFirst(IReadOnlyDictionary<string, string> query, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (query.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private static void RegisterProtocolHandler(string scheme)
    {
        if (string.IsNullOrWhiteSpace(scheme))
        {
            return;
        }

        var exePath = Process.GetCurrentProcess().MainModule?.FileName;
        if (string.IsNullOrWhiteSpace(exePath))
        {
            return;
        }

        using var key = Registry.CurrentUser.CreateSubKey($@"Software\Classes\{scheme}");
        if (key is null)
        {
            return;
        }

        key.SetValue(string.Empty, $"URL:{scheme} Protocol");
        key.SetValue("URL Protocol", string.Empty);

        using var shell = key.CreateSubKey(@"shell\open\command");
        shell?.SetValue(string.Empty, $"\"{exePath}\" \"%1\"");
    }
}
