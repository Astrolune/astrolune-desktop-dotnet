namespace Astrolune.Media.Module.Services;

public static class CaptureConstraints
{
    public const uint MaxWidth = 3840;
    public const uint MaxHeight = 2160;
    public const uint MaxFps = 60;

    /// <summary>
    /// Clamps FPS to the supported 1..60 range.
    /// </summary>
    public static uint ClampFps(uint? fps)
    {
        var value = fps ?? MaxFps;
        if (value < 1)
        {
            value = 1;
        }

        return Math.Min(value, MaxFps);
    }

    /// <summary>
    /// Clamps a resolution to 4K max while preserving aspect ratio.
    /// </summary>
    public static (uint width, uint height) ClampResolution(uint width, uint height)
    {
        width = Math.Max(1, width);
        height = Math.Max(1, height);

        if (width <= MaxWidth && height <= MaxHeight)
        {
            return (width, height);
        }

        var scale = Math.Min(MaxWidth / (double)width, MaxHeight / (double)height);
        var scaledWidth = (uint)Math.Max(1, Math.Round(width * scale));
        var scaledHeight = (uint)Math.Max(1, Math.Round(height * scale));
        return (scaledWidth, scaledHeight);
    }
}
