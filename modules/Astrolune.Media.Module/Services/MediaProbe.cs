using System.Runtime.InteropServices;
using NAudio.CoreAudioApi;

namespace Astrolune.Media.Module.Services;

/// <summary>
/// Implementation of IMediaProbe for probing media capabilities.
/// </summary>
public sealed class MediaProbe : IMediaProbe
{
    private readonly IEventDispatcher _dispatcher;
    private readonly IMediaService _mediaService;

    public MediaProbe(IEventDispatcher dispatcher, IMediaService mediaService)
    {
        _dispatcher = dispatcher;
        _mediaService = mediaService;
    }

    /// <inheritdoc />
    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var capabilities = new MediaCapabilities();

        var nvenc = await RunStepAsync(
            "NVENC availability",
            ProbeNvencAsync,
            cancellationToken).ConfigureAwait(false);
        capabilities = capabilities with { NvencAvailable = nvenc.Ok, NvencError = nvenc.Error };

        var dxgi = await RunStepAsync(
            "DXGI Desktop Duplication",
            ProbeDxgiAsync,
            cancellationToken).ConfigureAwait(false);
        capabilities = capabilities with { DxgiAvailable = dxgi.Ok, DxgiError = dxgi.Error };

        var audioInput = await RunStepAsync(
            "Audio input device",
            ProbeAudioInputAsync,
            cancellationToken).ConfigureAwait(false);
        capabilities = capabilities with { AudioInputAvailable = audioInput.Ok, AudioInputError = audioInput.Error };

        var audioOutput = await RunStepAsync(
            "Audio output device",
            ProbeAudioOutputAsync,
            cancellationToken).ConfigureAwait(false);
        capabilities = capabilities with { AudioOutputAvailable = audioOutput.Ok, AudioOutputError = audioOutput.Error };

        capabilities = capabilities with
        {
            ProbedAtUnixMs = (ulong)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };

        await _mediaService.SetCapabilitiesAsync(capabilities, cancellationToken).ConfigureAwait(false);
        await _dispatcher.EmitAsync("media://capabilities", capabilities, cancellationToken)
            .ConfigureAwait(false);
    }

    private async Task<(bool Ok, string? Error)> RunStepAsync(
        string label,
        Func<Task> probe,
        CancellationToken cancellationToken)
    {
        try
        {
            await probe().ConfigureAwait(false);
            await _dispatcher.EmitAsync(
                "media://probe-step",
                new ProbeStepEvent { Label = label, Ok = true, Message = "ok" },
                cancellationToken).ConfigureAwait(false);
            return (true, null);
        }
        catch (Exception ex)
        {
            await _dispatcher.EmitAsync(
                "media://probe-step",
                new ProbeStepEvent { Label = label, Ok = false, Message = ex.Message },
                cancellationToken).ConfigureAwait(false);
            return (false, ex.Message);
        }
    }

    private static Task ProbeNvencAsync()
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            if (NativeLibrary.TryLoad("nvEncodeAPI64.dll", out var handle))
            {
                NativeLibrary.Free(handle);
                return Task.CompletedTask;
            }

            return Task.CompletedTask;
        }

        throw new InvalidOperationException("Screen share is supported only on Windows.");
    }

    private static Task ProbeDxgiAsync()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            throw new InvalidOperationException("Screen share is supported only on Windows.");
        }

        if (!NativeLibrary.TryLoad("d3d11.dll", out var handle))
        {
            throw new InvalidOperationException("DXGI Desktop Duplication is not available.");
        }

        NativeLibrary.Free(handle);
        return Task.CompletedTask;
    }

    private static Task ProbeAudioInputAsync()
    {
        using var enumerator = new MMDeviceEnumerator();
        if (enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active).Count == 0)
        {
            throw new InvalidOperationException("No accessible microphone device found.");
        }

        return Task.CompletedTask;
    }

    private static Task ProbeAudioOutputAsync()
    {
        using var enumerator = new MMDeviceEnumerator();
        if (enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active).Count == 0)
        {
            throw new InvalidOperationException("No accessible speaker/headphone device found.");
        }

        return Task.CompletedTask;
    }
}
