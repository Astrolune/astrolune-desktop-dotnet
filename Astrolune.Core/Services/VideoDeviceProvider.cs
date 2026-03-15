using Astrolune.Core.Models;
using Windows.Devices.Enumeration;

namespace Astrolune.Core.Services;

internal sealed class VideoDeviceProvider
{
    public async Task<IReadOnlyList<MediaDevice>> ListVideoInputDevicesAsync()
    {
        var devices = await DeviceInformation.FindAllAsync(DeviceClass.VideoCapture);
        var results = new List<MediaDevice>();

        for (var index = 0; index < devices.Count; index++)
        {
            var device = devices[index];
            results.Add(new MediaDevice
            {
                Id = $"camera-{index}",
                Name = device.Name,
                Kind = "videoinput",
                IsDefault = index == 0
            });
        }

        return results;
    }
}
