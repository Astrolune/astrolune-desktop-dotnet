using Astrolune.Core.Services;

namespace Astrolune.Tests;

public class CaptureConstraintsTests
{
    [Fact]
    public void ClampFps_DefaultsToMax()
    {
        var result = CaptureConstraints.ClampFps(null);
        Assert.Equal(CaptureConstraints.MaxFps, result);
    }

    [Fact]
    public void ClampFps_ClampsHighValues()
    {
        var result = CaptureConstraints.ClampFps(240);
        Assert.Equal(CaptureConstraints.MaxFps, result);
    }

    [Fact]
    public void ClampFps_ClampsLowValues()
    {
        var result = CaptureConstraints.ClampFps(0);
        Assert.Equal(1u, result);
    }

    [Fact]
    public void ClampFps_PreservesValidValues()
    {
        var result = CaptureConstraints.ClampFps(30);
        Assert.Equal(30u, result);
    }

    [Fact]
    public void ClampResolution_PreservesWithinBounds()
    {
        var (width, height) = CaptureConstraints.ClampResolution(1920, 1080);
        Assert.Equal(1920u, width);
        Assert.Equal(1080u, height);
    }

    [Fact]
    public void ClampResolution_ScalesDownTo4K()
    {
        var (width, height) = CaptureConstraints.ClampResolution(7680, 4320);
        Assert.Equal(3840u, width);
        Assert.Equal(2160u, height);
    }

    [Fact]
    public void ClampResolution_ScalesWideScreens()
    {
        var (width, height) = CaptureConstraints.ClampResolution(5120, 1440);
        Assert.Equal(3840u, width);
        Assert.Equal(1080u, height);
    }

    [Fact]
    public void ClampResolution_ClampsZeroDimensions()
    {
        var (width, height) = CaptureConstraints.ClampResolution(0, 0);
        Assert.Equal(1u, width);
        Assert.Equal(1u, height);
    }

    [Fact]
    public void ClampResolution_ScalesTallScreens()
    {
        var (width, height) = CaptureConstraints.ClampResolution(2160, 8000);
        Assert.Equal(583u, width);
        Assert.Equal(2160u, height);
    }

    [Fact]
    public void ClampResolution_ScalesLargeLandscape()
    {
        var (width, height) = CaptureConstraints.ClampResolution(5000, 3000);
        Assert.Equal(3600u, width);
        Assert.Equal(2160u, height);
    }
}
