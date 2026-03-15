using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace Astrolune.Desktop;

public partial class MainWindow : Window
{
    private readonly WebViewBridge _bridge;

    public MainWindow(WebViewBridge bridge)
    {
        _bridge = bridge;
        InitializeComponent();
        Loaded += OnLoaded;
        SourceInitialized += OnSourceInitialized;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        var options = BuildHostOptions();
        await _bridge.InitializeAsync(WebView, options);
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        if (PresentationSource.FromVisual(this) is not HwndSource source)
        {
            return;
        }

        source.AddHook(WndProc);
    }

    private static IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        const int WM_GETMINMAXINFO = 0x0024;

        if (msg == WM_GETMINMAXINFO)
        {
            UpdateMaximizedSize(hwnd, lParam);
            handled = true;
        }

        return IntPtr.Zero;
    }

    private static void UpdateMaximizedSize(IntPtr hwnd, IntPtr lParam)
    {
        var monitor = MonitorFromWindow(hwnd, MonitorDefaultToNearest);
        if (monitor == IntPtr.Zero)
        {
            return;
        }

        var monitorInfo = new MonitorInfo
        {
            Size = Marshal.SizeOf<MonitorInfo>()
        };

        if (!GetMonitorInfo(monitor, ref monitorInfo))
        {
            return;
        }

        var work = monitorInfo.WorkArea;
        var monitorArea = monitorInfo.MonitorArea;
        var minMaxInfo = Marshal.PtrToStructure<MinMaxInfo>(lParam);

        minMaxInfo.MaxPosition.X = Math.Abs(work.Left - monitorArea.Left);
        minMaxInfo.MaxPosition.Y = Math.Abs(work.Top - monitorArea.Top);
        minMaxInfo.MaxSize.X = Math.Abs(work.Right - work.Left);
        minMaxInfo.MaxSize.Y = Math.Abs(work.Bottom - work.Top);

        Marshal.StructureToPtr(minMaxInfo, lParam, true);
    }

    private const uint MonitorDefaultToNearest = 2;

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MonitorInfo lpmi);

    [StructLayout(LayoutKind.Sequential)]
    private struct Point
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MinMaxInfo
    {
        public Point Reserved;
        public Point MaxSize;
        public Point MaxPosition;
        public Point MinTrackSize;
        public Point MaxTrackSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct MonitorInfo
    {
        public int Size;
        public Rect MonitorArea;
        public Rect WorkArea;
        public uint Flags;
    }

    private static WebViewHostOptions BuildHostOptions()
    {
        var devUrl = Environment.GetEnvironmentVariable("ASTROLUNE_DEV_URL") ?? "http://localhost:5173";
        var useDevServer = Debugger.IsAttached ||
                           string.Equals(Environment.GetEnvironmentVariable("ASTROLUNE_USE_DEVSERVER"), "1",
                               StringComparison.OrdinalIgnoreCase);

        var outputFrontend = Path.Combine(AppContext.BaseDirectory, "frontend");
        var fallbackFrontend = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..",
            "..",
            "..",
            "..",
            "frontend",
            "dist"));

        var frontendFolder = Directory.Exists(outputFrontend) ? outputFrontend : fallbackFrontend;

        return new WebViewHostOptions
        {
            DevServerUrl = devUrl,
            FrontendFolder = frontendFolder,
            UseDevServer = useDevServer
        };
    }
}
