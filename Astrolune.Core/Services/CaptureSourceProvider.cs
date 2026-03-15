using System.Globalization;
using System.Text;
using Astrolune.Core.Interop;
using Astrolune.Core.Models;

namespace Astrolune.Core.Services;

internal sealed class CaptureSourceProvider
{
    private const string ThumbnailPlaceholder =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

    public IReadOnlyList<CaptureSource> ListSources()
    {
        var sources = new List<CaptureSource>();
        EnumerateMonitors(sources);
        EnumerateWindows(sources);
        return sources;
    }

    private static void EnumerateMonitors(List<CaptureSource> sources)
    {
        Win32.EnumDisplayMonitors(
            IntPtr.Zero,
            IntPtr.Zero,
            (IntPtr monitor, IntPtr hdc, ref Win32.Rect rect, IntPtr data) =>
        {
            var info = new Win32.MonitorInfoEx
            {
                Size = (uint)System.Runtime.InteropServices.Marshal.SizeOf<Win32.MonitorInfoEx>()
            };

            if (!Win32.GetMonitorInfo(monitor, ref info))
            {
                return true;
            }

            var width = Math.Max(1, info.Monitor.Right - info.Monitor.Left);
            var height = Math.Max(1, info.Monitor.Bottom - info.Monitor.Top);
            var isPrimary = (info.Flags & Win32.MonitorDefaultToPrimary) == Win32.MonitorDefaultToPrimary;
            var deviceName = string.IsNullOrWhiteSpace(info.DeviceName) ? "Monitor" : info.DeviceName.Trim();
            var displayName = isPrimary
                ? $"Primary Monitor ({deviceName})"
                : $"Monitor ({deviceName})";

            sources.Add(new CaptureSource
            {
                Id = $"monitor:{monitor.ToInt64().ToString(CultureInfo.InvariantCulture)}",
                Kind = "monitor",
                Name = displayName,
                Thumbnail = ThumbnailPlaceholder,
                Width = (uint)width,
                Height = (uint)height,
                IsPrimary = isPrimary
            });

            return true;
        },
            IntPtr.Zero);
    }

    private static void EnumerateWindows(List<CaptureSource> sources)
    {
        Win32.EnumWindows((hwnd, _) =>
        {
            if (!Win32.IsWindowVisible(hwnd))
            {
                return true;
            }

            var length = Win32.GetWindowTextLengthW(hwnd);
            if (length <= 0)
            {
                return true;
            }

            var builder = new StringBuilder(length + 1);
            if (Win32.GetWindowTextW(hwnd, builder, builder.Capacity) <= 0)
            {
                return true;
            }

            var title = builder.ToString().Trim();
            if (string.IsNullOrWhiteSpace(title))
            {
                return true;
            }

            if (!Win32.GetWindowRect(hwnd, out var rect))
            {
                return true;
            }

            var width = Math.Max(1, rect.Right - rect.Left);
            var height = Math.Max(1, rect.Bottom - rect.Top);

            sources.Add(new CaptureSource
            {
                Id = $"window:{hwnd.ToInt64().ToString(CultureInfo.InvariantCulture)}",
                Kind = "window",
                Name = title,
                Thumbnail = ThumbnailPlaceholder,
                Width = (uint)width,
                Height = (uint)height,
                IsPrimary = false
            });

            return true;
        }, IntPtr.Zero);
    }
}
