using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;
using System.Runtime.InteropServices.WindowsRuntime;
using Astrolune.Sdk.Models;
using Windows.Graphics.Capture;
using Windows.Graphics.DirectX;
using Windows.Graphics.DirectX.Direct3D11;
using Windows.Graphics.Imaging;
using Windows.Storage.Streams;
using Windows.Win32;
using Windows.Win32.Foundation;
using Windows.Win32.Graphics.Direct3D;
using Windows.Win32.Graphics.Direct3D11;
using Windows.Win32.Graphics.Dxgi;
using Windows.Win32.Graphics.Gdi;
using Windows.Win32.System.WinRT;
using Windows.Win32.System.WinRT.Graphics.Capture;
using static Windows.Win32.PInvoke;

namespace Astrolune.Media.Module.Services;

internal sealed class ScreenCaptureSession : IAsyncDisposable
{
    private readonly IEventDispatcher _dispatcher;
    private readonly CaptureSource _source;
    private readonly uint _fps;
    private readonly bool _cursorEnabled;
    private readonly CancellationTokenSource _cts;
    private readonly Task _worker;
    private readonly AutoResetEvent _frameEvent = new(false);
    private readonly object _statsLock = new();
    private double _fpsActual;
    private uint _bitrateKbps;
    private uint _droppedFrames;
    private uint _width;
    private uint _height;

    private readonly IDirect3DDevice _device;
    private readonly ID3D11Device _d3dDevice;
    private readonly ID3D11DeviceContext _d3dContext;
    private readonly GraphicsCaptureItem _item;
    private Direct3D11CaptureFramePool _framePool;
    private GraphicsCaptureSession _session;

    public string SessionId { get; }

    private ScreenCaptureSession(
        IEventDispatcher dispatcher,
        CaptureSource source,
        uint fps,
        bool cursorEnabled)
    {
        _dispatcher = dispatcher;
        _source = source;
        _fps = CaptureConstraints.ClampFps(fps);
        _cursorEnabled = cursorEnabled;
        _cts = new CancellationTokenSource();
        SessionId = $"screen-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

        if (!GraphicsCaptureSession.IsSupported())
        {
            throw new InvalidOperationException("Graphics capture is not supported on this device.");
        }

        _device = CreateD3DDevice(out _d3dDevice, out _d3dContext);
        _item = CreateCaptureItem(source);
        _framePool = Direct3D11CaptureFramePool.CreateFreeThreaded(
            _device,
            DirectXPixelFormat.B8G8R8A8UIntNormalized,
            2,
            _item.Size);
        _framePool.FrameArrived += OnFrameArrived;

        _session = _framePool.CreateCaptureSession(_item);
        TryConfigureSession(_session, _cursorEnabled);
        _session.StartCapture();

        _worker = Task.Run(RunAsync, _cts.Token);
    }

    public static ScreenCaptureSession Start(
        IEventDispatcher dispatcher,
        CaptureSource source,
        uint fps,
        bool cursorEnabled)
    {
        return new ScreenCaptureSession(dispatcher, source, fps, cursorEnabled);
    }

    public CaptureStats GetStats()
    {
        lock (_statsLock)
        {
            return new CaptureStats
            {
                FpsActual = _fpsActual,
                Resolution = new[] { _width, _height },
                BitrateKbps = _bitrateKbps,
                DroppedFrames = _droppedFrames,
                Encoder = "gpu-bgra"
            };
        }
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
        _frameEvent.Set();
        try
        {
            await _worker.ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            // Expected when stopping capture.
        }
        finally
        {
            _session.Dispose();
            _framePool.FrameArrived -= OnFrameArrived;
            _framePool.Dispose();
        }
    }

    private async Task RunAsync()
    {
        _ = RoInitialize(RO_INIT_TYPE.RO_INIT_MULTITHREADED);

        await _dispatcher.EmitAsync(
            "capture://screen/state",
            new ScreenCaptureState
            {
                SessionId = SessionId,
                Status = "started",
                Message = null
            },
            _cts.Token).ConfigureAwait(false);

        var frameInterval = TimeSpan.FromMilliseconds(1000.0 / _fps);
        var stopwatch = Stopwatch.StartNew();
        var windowStart = stopwatch.Elapsed;
        var framesThisWindow = 0;
        var bytesThisWindow = 0L;
        var lastFrameAt = TimeSpan.Zero;

        while (!_cts.Token.IsCancellationRequested)
        {
            _frameEvent.WaitOne(100);
            if (_cts.Token.IsCancellationRequested)
            {
                break;
            }

            using var frame = _framePool.TryGetNextFrame();
            if (frame is null)
            {
                continue;
            }

            if (frame.ContentSize.Width <= 0 || frame.ContentSize.Height <= 0)
            {
                continue;
            }

            if (frame.ContentSize.Width != _item.Size.Width ||
                frame.ContentSize.Height != _item.Size.Height)
            {
                _framePool.Recreate(
                    _device,
                    DirectXPixelFormat.B8G8R8A8UIntNormalized,
                    2,
                    frame.ContentSize);
            }

            var now = stopwatch.Elapsed;
            if (now - lastFrameAt < frameInterval)
            {
                lock (_statsLock)
                {
                    _droppedFrames += 1;
                }
                continue;
            }

            lastFrameAt = now;

            try
            {
                var (payload, rawBytes) = await BuildFrameAsync(frame).ConfigureAwait(false);
                await _dispatcher.EmitAsync("capture://screen/frame", payload, _cts.Token)
                    .ConfigureAwait(false);

                framesThisWindow++;
                bytesThisWindow += rawBytes;
            }
            catch (Exception ex)
            {
                await _dispatcher.EmitAsync(
                    "capture://screen/state",
                    new ScreenCaptureState
                    {
                        SessionId = SessionId,
                        Status = "error",
                        Message = ex.Message
                    },
                    _cts.Token).ConfigureAwait(false);
            }

            var windowElapsed = stopwatch.Elapsed - windowStart;
            if (windowElapsed >= TimeSpan.FromSeconds(1))
            {
                lock (_statsLock)
                {
                    _fpsActual = framesThisWindow / windowElapsed.TotalSeconds;
                    _bitrateKbps = (uint)Math.Max(1, (bytesThisWindow * 8.0 / 1000.0) / windowElapsed.TotalSeconds);
                }

                windowStart = stopwatch.Elapsed;
                framesThisWindow = 0;
                bytesThisWindow = 0;
            }
        }

        await _dispatcher.EmitAsync(
            "capture://screen/state",
            new ScreenCaptureState
            {
                SessionId = SessionId,
                Status = "stopped",
                Message = null
            },
            CancellationToken.None).ConfigureAwait(false);

        RoUninitialize();
    }

    private async Task<(ScreenCaptureFrame frame, int rawBytes)> BuildFrameAsync(Direct3D11CaptureFrame frame)
    {
        var surface = frame.Surface;
        var softwareBitmap = await SoftwareBitmap.CreateCopyFromSurfaceAsync(surface).AsTask().ConfigureAwait(false);
        var bitmap = SoftwareBitmap.Convert(softwareBitmap, BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);

        using var bitmapBuffer = bitmap.LockBuffer(BitmapBufferAccessMode.Read);
        var desc = bitmapBuffer.GetPlaneDescription(0);
        var capacity = desc.Stride * desc.Height;
        var buffer = new Windows.Storage.Streams.Buffer((uint)capacity);
        bitmap.CopyToBuffer(buffer);
        var data = new byte[capacity];
        DataReader.FromBuffer(buffer).ReadBytes(data);

        var sourceWidth = (uint)bitmap.PixelWidth;
        var sourceHeight = (uint)bitmap.PixelHeight;
        var (targetWidth, targetHeight) = CaptureConstraints.ClampResolution(sourceWidth, sourceHeight);
        var stride = desc.Stride;

        if (targetWidth != sourceWidth || targetHeight != sourceHeight)
        {
            var scaled = DownscaleBgra(data, (int)sourceWidth, (int)sourceHeight, stride, (int)targetWidth, (int)targetHeight);
            data = scaled;
            stride = (int)targetWidth * 4;
        }

        lock (_statsLock)
        {
            _width = targetWidth;
            _height = targetHeight;
        }

        var timestampUs = (ulong)(Stopwatch.GetTimestamp() * 1_000_000 / Stopwatch.Frequency);

        var payload = new ScreenCaptureFrame
        {
            SessionId = SessionId,
            Width = targetWidth,
            Height = targetHeight,
            Stride = (uint)Math.Abs(stride),
            TimestampUs = timestampUs,
            Format = "bgra",
            DataBase64 = Convert.ToBase64String(data)
        };

        return (payload, data.Length);
    }

    private static byte[] DownscaleBgra(byte[] source, int srcWidth, int srcHeight, int srcStride, int dstWidth, int dstHeight)
    {
        var dstStride = dstWidth * 4;
        var output = new byte[dstStride * dstHeight];

        for (var y = 0; y < dstHeight; y++)
        {
            var srcY = (int)((long)y * srcHeight / dstHeight);
            var srcRow = srcY * srcStride;
            var dstRow = y * dstStride;

            for (var x = 0; x < dstWidth; x++)
            {
                var srcX = (int)((long)x * srcWidth / dstWidth);
                var srcIndex = srcRow + srcX * 4;
                var dstIndex = dstRow + x * 4;

                output[dstIndex] = source[srcIndex];
                output[dstIndex + 1] = source[srcIndex + 1];
                output[dstIndex + 2] = source[srcIndex + 2];
                output[dstIndex + 3] = source[srcIndex + 3];
            }
        }

        return output;
    }

    private void OnFrameArrived(Direct3D11CaptureFramePool sender, object args)
    {
        _frameEvent.Set();
    }

    private static void TryConfigureSession(GraphicsCaptureSession session, bool cursorEnabled)
    {
        try
        {
            session.IsCursorCaptureEnabled = cursorEnabled;
        }
        catch
        {
            // Ignore if unsupported.
        }

        var borderProperty = session.GetType().GetProperty("IsBorderRequired");
        if (borderProperty?.CanWrite == true)
        {
            borderProperty.SetValue(session, false);
        }
    }

    private static IDirect3DDevice CreateD3DDevice(out ID3D11Device device, out ID3D11DeviceContext context)
    {
        var featureLevels = new[]
        {
            D3D_FEATURE_LEVEL.D3D_FEATURE_LEVEL_11_1,
            D3D_FEATURE_LEVEL.D3D_FEATURE_LEVEL_11_0
        };

        var result = D3D11CreateDevice(
            (IDXGIAdapter?)null,
            D3D_DRIVER_TYPE.D3D_DRIVER_TYPE_HARDWARE,
            HMODULE.Null,
            D3D11_CREATE_DEVICE_FLAG.D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            featureLevels,
            D3D11_SDK_VERSION,
            out device,
            out context);

        if (result.Failed)
        {
            throw new InvalidOperationException("Failed to create D3D11 device.");
        }

        unsafe
        {
            var iid = typeof(IDXGIDevice).GUID;
            var devicePtr = (ID3D11Device_unmanaged*)ComInterfaceMarshaller<ID3D11Device>.ConvertToUnmanaged(device);
            try
            {
                void* dxgiPtr;
                var hr = devicePtr->QueryInterface(&iid, &dxgiPtr);
                if (hr.Failed)
                {
                    throw new InvalidOperationException("Failed to query IDXGIDevice from D3D11 device.");
                }

                try
                {
                    var dxgiDevice = ComInterfaceMarshaller<IDXGIDevice>.ConvertToManaged(dxgiPtr);
                    var hrCreate = CreateDirect3D11DeviceFromDXGIDevice(dxgiDevice, out var direct3DDevice);
                    if (hrCreate.Failed)
                    {
                        throw new InvalidOperationException("Failed to create Direct3D device.");
                    }

                    return (IDirect3DDevice)direct3DDevice;
                }
                finally
                {
                    ComInterfaceMarshaller<IDXGIDevice>.Free(dxgiPtr);
                }
            }
            finally
            {
                ComInterfaceMarshaller<ID3D11Device>.Free(devicePtr);
            }
        }
    }

    private static GraphicsCaptureItem CreateCaptureItem(CaptureSource source)
    {
        var parts = source.Id.Split(':', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2 || !long.TryParse(parts[1], out var raw))
        {
            throw new InvalidOperationException($"Invalid capture source id '{source.Id}'.");
        }

        var factory = (IGraphicsCaptureItemInterop)GetActivationFactory(typeof(GraphicsCaptureItem));
        var guid = typeof(GraphicsCaptureItem).GUID;
        object result;

        if (source.Kind == "monitor")
        {
            factory.CreateForMonitor(new HMONITOR(new IntPtr(raw)), guid, out result);
        }
        else
        {
            factory.CreateForWindow(new HWND(new IntPtr(raw)), guid, out result);
        }

        return (GraphicsCaptureItem)result;
    }

    private static object GetActivationFactory(Type type)
    {
        var method = typeof(WindowsRuntimeMarshal).GetMethod(
            "GetActivationFactory",
            new[] { typeof(Type) });

        if (method is null)
        {
            throw new InvalidOperationException("WindowsRuntimeMarshal.GetActivationFactory is not available.");
        }

        return method.Invoke(null, new object[] { type })!;
    }
}
