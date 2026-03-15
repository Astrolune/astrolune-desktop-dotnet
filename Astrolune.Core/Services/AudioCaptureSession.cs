using System.Diagnostics;
using System.Threading.Channels;
using Astrolune.Core.Models;
using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace Astrolune.Core.Services;

internal sealed class AudioCaptureSession : IAsyncDisposable
{
    private const uint DefaultSampleRate = 48_000;
    private const uint DefaultChannels = 1;
    private const uint DefaultChunkMs = 20;
    private const short DefaultNoiseGateThreshold = 500;

    private readonly IEventDispatcher _dispatcher;
    private readonly WasapiCapture _capture;
    private readonly Channel<short[]> _frames;
    private readonly CancellationTokenSource _cts;
    private readonly Task _worker;

    public string SessionId { get; }

    private readonly uint _targetSampleRate;
    private readonly uint _targetChannels;
    private readonly uint _chunkMs;
    private readonly short _noiseGateThreshold;
    private readonly uint _inputSampleRate;
    private readonly int _inputChannels;

    private AudioCaptureSession(
        IEventDispatcher dispatcher,
        WasapiCapture capture,
        uint inputSampleRate,
        int inputChannels,
        AudioCaptureRequest request)
    {
        _dispatcher = dispatcher;
        _capture = capture;
        _inputSampleRate = inputSampleRate;
        _inputChannels = inputChannels;
        _frames = Channel.CreateUnbounded<short[]>();
        _cts = new CancellationTokenSource();
        SessionId = $"audio-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        _targetSampleRate = Math.Max(8_000, request.SampleRate ?? DefaultSampleRate);
        _targetChannels = Math.Max(1, request.Channels ?? DefaultChannels);
        _chunkMs = Math.Clamp(request.ChunkMs ?? DefaultChunkMs, 10, 100);
        _noiseGateThreshold = request.NoiseGateThreshold ?? DefaultNoiseGateThreshold;

        _capture.DataAvailable += OnDataAvailable;
        _capture.RecordingStopped += OnRecordingStopped;
        _worker = Task.Run(RunAsync, _cts.Token);
    }

    public static AudioCaptureSession Start(
        IEventDispatcher dispatcher,
        MMDevice device,
        AudioCaptureRequest request)
    {
        var capture = new WasapiCapture(device);
        var format = capture.WaveFormat;
        var session = new AudioCaptureSession(
            dispatcher,
            capture,
            (uint)format.SampleRate,
            format.Channels,
            request);
        capture.StartRecording();
        return session;
    }

    public async ValueTask DisposeAsync()
    {
        await StopAsync().ConfigureAwait(false);
    }

    public async Task StopAsync()
    {
        if (_cts.IsCancellationRequested)
        {
            return;
        }

        _cts.Cancel();
        _capture.StopRecording();

        try
        {
            await _worker.ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            // Expected during shutdown.
        }

        _capture.Dispose();
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs args)
    {
        if (_cts.IsCancellationRequested)
        {
            return;
        }

        var buffer = new byte[args.BytesRecorded];
        Array.Copy(args.Buffer, buffer, args.BytesRecorded);
        var samples = ConvertToInt16(buffer, _capture.WaveFormat);
        if (samples.Length == 0)
        {
            return;
        }

        _frames.Writer.TryWrite(samples);
    }

    private void OnRecordingStopped(object? sender, StoppedEventArgs args)
    {
        _frames.Writer.TryComplete();
    }

    private async Task RunAsync()
    {
        await _dispatcher.EmitAsync(
            "capture://audio/state",
            new AudioCaptureState
            {
                SessionId = SessionId,
                Status = "started",
                Message = null
            },
            _cts.Token).ConfigureAwait(false);

        var samplesPerChunk = (int)(_targetSampleRate * _chunkMs / 1000) * (int)_targetChannels;
        var pcmBuffer = new List<short>(samplesPerChunk * 2);

        await foreach (var inputChunk in _frames.Reader.ReadAllAsync(_cts.Token).ConfigureAwait(false))
        {
            var processed = _inputSampleRate == _targetSampleRate
                ? inputChunk
                : ResampleLinear(inputChunk, _inputSampleRate, _targetSampleRate);

            ApplyNoiseGate(processed, _noiseGateThreshold);
            processed = _targetChannels > 1
                ? UpmixMono(processed, _targetChannels)
                : processed;

            pcmBuffer.AddRange(processed);

            while (pcmBuffer.Count >= samplesPerChunk)
            {
                var frameSamples = pcmBuffer.GetRange(0, samplesPerChunk).ToArray();
                pcmBuffer.RemoveRange(0, samplesPerChunk);

                var payload = new AudioCaptureFrame
                {
                    SessionId = SessionId,
                    SampleRate = _targetSampleRate,
                    Channels = _targetChannels,
                    SamplesPerChannel = (uint)(samplesPerChunk / (int)_targetChannels),
                    TimestampMs = (ulong)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    Format = "s16le",
                    DataBase64 = Convert.ToBase64String(ToLittleEndianBytes(frameSamples))
                };

                await _dispatcher.EmitAsync("capture://audio/frame", payload, _cts.Token)
                    .ConfigureAwait(false);
            }
        }

        await _dispatcher.EmitAsync(
            "capture://audio/state",
            new AudioCaptureState
            {
                SessionId = SessionId,
                Status = "stopped",
                Message = null
            },
            CancellationToken.None).ConfigureAwait(false);
    }

    private short[] ConvertToInt16(byte[] data, WaveFormat format)
    {
        if (format.Encoding == WaveFormatEncoding.IeeeFloat)
        {
            var floats = new float[data.Length / 4];
            Buffer.BlockCopy(data, 0, floats, 0, data.Length);
            return Downmix(floats, _inputChannels);
        }

        if (format.BitsPerSample == 16)
        {
            var samples = new short[data.Length / 2];
            Buffer.BlockCopy(data, 0, samples, 0, data.Length);
            return Downmix(samples, _inputChannels);
        }

        if (format.BitsPerSample == 32)
        {
            var ints = new int[data.Length / 4];
            Buffer.BlockCopy(data, 0, ints, 0, data.Length);
            var samples = ints.Select(value => (short)Math.Clamp(value / 65536, short.MinValue, short.MaxValue)).ToArray();
            return Downmix(samples, _inputChannels);
        }

        return Array.Empty<short>();
    }

    private static short[] Downmix(float[] samples, int channels)
    {
        if (channels <= 1)
        {
            return samples
                .Select(value => (short)(Math.Clamp(value, -1f, 1f) * short.MaxValue))
                .ToArray();
        }

        var mono = new short[samples.Length / channels];
        for (var i = 0; i < mono.Length; i++)
        {
            var offset = i * channels;
            var sum = 0f;
            for (var ch = 0; ch < channels; ch++)
            {
                sum += samples[offset + ch];
            }
            mono[i] = (short)(Math.Clamp(sum / channels, -1f, 1f) * short.MaxValue);
        }

        return mono;
    }

    private static short[] Downmix(short[] samples, int channels)
    {
        if (channels <= 1)
        {
            return samples;
        }

        var mono = new short[samples.Length / channels];
        for (var i = 0; i < mono.Length; i++)
        {
            var offset = i * channels;
            var sum = 0;
            for (var ch = 0; ch < channels; ch++)
            {
                sum += samples[offset + ch];
            }
            mono[i] = (short)(sum / channels);
        }

        return mono;
    }

    private static short[] ResampleLinear(short[] samples, uint fromRate, uint toRate)
    {
        if (samples.Length == 0 || fromRate == toRate)
        {
            return samples;
        }

        var ratio = (double)toRate / fromRate;
        var outputLength = (int)Math.Round(samples.Length * ratio);
        var output = new short[outputLength];

        for (var i = 0; i < outputLength; i++)
        {
            var sourcePos = i / ratio;
            var left = (int)Math.Floor(sourcePos);
            var right = Math.Min(left + 1, samples.Length - 1);
            var frac = sourcePos - left;
            var interpolated = samples[left] + (samples[right] - samples[left]) * frac;
            output[i] = (short)Math.Clamp(interpolated, short.MinValue, short.MaxValue);
        }

        return output;
    }

    private static void ApplyNoiseGate(short[] samples, short threshold)
    {
        var limit = Math.Abs(threshold);
        for (var i = 0; i < samples.Length; i++)
        {
            if (Math.Abs(samples[i]) < limit)
            {
                samples[i] = 0;
            }
        }
    }

    private static short[] UpmixMono(short[] samples, uint channels)
    {
        if (channels <= 1)
        {
            return samples;
        }

        var output = new short[samples.Length * (int)channels];
        var index = 0;
        foreach (var sample in samples)
        {
            for (var ch = 0; ch < channels; ch++)
            {
                output[index++] = sample;
            }
        }

        return output;
    }

    private static byte[] ToLittleEndianBytes(short[] samples)
    {
        var bytes = new byte[samples.Length * 2];
        Buffer.BlockCopy(samples, 0, bytes, 0, bytes.Length);
        return bytes;
    }
}
