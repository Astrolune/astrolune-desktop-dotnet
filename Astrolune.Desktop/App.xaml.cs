using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows;
using Astrolune.Sdk.Modules;
using Astrolune.Sdk.Services;
using Astrolune.Desktop.Modules;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Win32;

namespace Astrolune.Desktop;

public partial class App : Application
{
    private IHost? _host;
    private Mutex? _instanceMutex;
    private CancellationTokenSource? _deeplinkCts;
    private Task? _deeplinkServerTask;
    private AuthCallbackManager? _authCallbacks;
    private ModuleLoader? _moduleLoader;

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

        var splashState = new SplashState();
        var splash = new SplashWindow(splashState);
        splash.Show();

        void UpdateSplash(string step, double progress)
        {
            splash.Dispatcher.Invoke(() =>
            {
                splashState.CurrentStep = step;
                splashState.Progress = progress;
            });
        }

        void SetWarning(string warning)
        {
            splash.Dispatcher.Invoke(() => splashState.Warning = warning);
        }

        void SetError(string error)
        {
            splash.Dispatcher.Invoke(() => splashState.Error = error);
        }

        try
        {
            UpdateSplash("Initializing", 0.05);

            var registry = new ModuleRegistry();
            var prompt = new WpfModuleUserPrompt();
            var permissionStore = new ModulePermissionStore(GetPermissionStorePath());
            var permissionService = new ModulePermissionService(permissionStore, prompt);
            var signatureVerifier = new ModuleSignatureVerifier();

            var hostVersion = Assembly.GetEntryAssembly()?.GetName().Version ?? new Version(1, 0, 0, 0);
            var sdkVersion = typeof(IModule).Assembly.GetName().Version ?? new Version(1, 0, 0, 0);
            var modulesRoot = Path.Combine(AppContext.BaseDirectory, "modules");
            var loaderOptions = new ModuleLoaderOptions
            {
                ModulesRoot = modulesRoot,
                HostVersion = hostVersion,
                SdkVersion = sdkVersion
            };

            var updateStatePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "Astrolune",
                "module-updates.json");
            var updateOptions = new ModuleUpdateOptions
            {
                IsEnabled = true,
                CheckInterval = TimeSpan.FromHours(1),
                StatePath = updateStatePath
            };

            var updateState = new ModuleUpdateStateStore(updateOptions.StatePath ?? updateStatePath);
            var moduleLoader = new ModuleLoader(
                loaderOptions,
                registry,
                signatureVerifier,
                permissionService,
                prompt,
                NullLogger<ModuleLoader>.Instance);
            _moduleLoader = moduleLoader;
            var moduleUpdater = new ModuleUpdater(
                updateOptions,
                loaderOptions,
                registry,
                signatureVerifier,
                prompt,
                updateState,
                NullLogger<ModuleUpdater>.Instance);

            UpdateSplash("Checking for module updates", 0.15);
            var initialCandidates = moduleLoader.DiscoverModules();
            var manifests = initialCandidates.Select(candidate => candidate.Manifest).ToList();
            var totalModules = Math.Max(1, manifests.Count);
            var completed = 0;
            var updateProgress = new Progress<ModuleUpdateProgress>(progress =>
            {
                if (progress.Stage is ModuleUpdateStage.Skipped or ModuleUpdateStage.Failed or ModuleUpdateStage.Staged)
                {
                    completed++;
                    var ratio = Math.Clamp((double)completed / totalModules, 0, 1);
                    UpdateSplash("Checking for module updates", 0.15 + (0.2 * ratio));
                }
            });
            await moduleUpdater.RunUpdateCheckAsync(manifests, updateProgress, CancellationToken.None).ConfigureAwait(false);

            UpdateSplash("Applying pending updates", 0.35);
            moduleLoader.ApplyPendingUpdates();

            UpdateSplash("Verifying modules", 0.45);
            var ordered = moduleLoader.VerifyAndOrderModules(moduleLoader.DiscoverModules());

            UpdateSplash("Loading modules", 0.55);
            _host = Host.CreateDefaultBuilder()
                .ConfigureServices(services =>
                {
                    services.AddSingleton(splashState);
                    services.AddSingleton(splash);
                    services.AddSingleton<AuthClientLauncher>();
                    services.AddSingleton<AuthCallbackManager>();
                    services.AddSingleton<BridgeCommandRouter>();
                    services.AddSingleton<WebViewBridge>();
                    services.AddSingleton<MainWindow>();

                    services.AddSingleton(registry);
                    services.AddSingleton<IModuleRegistry>(registry);
                    services.AddSingleton(prompt);
                    services.AddSingleton<IModuleUserPrompt>(prompt);
                    services.AddSingleton(permissionStore);
                    services.AddSingleton<IModulePermissionService>(permissionService);
                    services.AddSingleton(signatureVerifier);
                    services.AddSingleton(loaderOptions);
                    services.AddSingleton(updateOptions);
                    services.AddSingleton(updateState);
                    services.AddSingleton(moduleLoader);
                    services.AddSingleton(moduleUpdater);

                    moduleLoader.LoadModules(ordered, services);
                })
                .Build();

            await _host.StartAsync().ConfigureAwait(false);

            _authCallbacks = _host.Services.GetRequiredService<AuthCallbackManager>();
            var authLauncher = _host.Services.GetRequiredService<AuthClientLauncher>();
            RegisterProtocolHandler(authLauncher.CallbackScheme);
            StartDeepLinkServer(authLauncher.CallbackScheme);
            ProcessDeepLinkArgs(e.Args, authLauncher.CallbackScheme);

            var main = _host.Services.GetRequiredService<MainWindow>();
            MainWindow = main;
            main.Hide();

            UpdateSplash("Starting services", 0.75);
            await moduleLoader.InitializeModulesAsync(CancellationToken.None).ConfigureAwait(false);

            UpdateSplash("Health checks", 0.85);
            await moduleLoader.RunInitialHealthChecksAsync(CancellationToken.None).ConfigureAwait(false);
            moduleLoader.StartHealthMonitor();

            var warningModules = registry.Modules
                .Where(info => info.Status is ModuleStatus.Degraded or ModuleStatus.Failed or ModuleStatus.Disabled)
                .ToList();
            if (warningModules.Count > 0)
            {
                SetWarning($"Some modules are not healthy: {string.Join(", ", warningModules.Select(info => info.Id))}");
            }

            var probe = _host.Services.GetRequiredService<IMediaProbe>();
            try
            {
                await probe.RunAsync().ConfigureAwait(false);
            }
            catch
            {
                // Startup probe errors are surfaced to the UI via events.
            }

            UpdateSplash("Ready", 1.0);
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
        }
        catch (Exception ex)
        {
            SetError($"Startup failed: {ex.Message}");
        }
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

        if (_moduleLoader is not null)
        {
            await _moduleLoader.StopAsync(CancellationToken.None).ConfigureAwait(false);
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

        // Пробуем найти Astrolune.React в разных местах
        var possiblePaths = new[]
        {
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Astrolune.React")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "Astrolune.React")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "Astrolune.React")),
            Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "Astrolune.React"))
        };

        string? frontendRoot = null;
        foreach (var path in possiblePaths)
        {
            if (Directory.Exists(path) && File.Exists(Path.Combine(path, "package.json")))
            {
                frontendRoot = path;
                break;
            }
        }

        if (string.IsNullOrEmpty(frontendRoot))
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

    private static string GetPermissionStorePath()
    {
        var root = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(root, "Astrolune", "module-permissions.dat");
    }
}
