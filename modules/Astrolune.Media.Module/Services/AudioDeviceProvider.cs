using Astrolune.Sdk.Models;
using NAudio.CoreAudioApi;

namespace Astrolune.Media.Module.Services;

internal sealed class AudioDeviceProvider
{
    public IReadOnlyList<AudioInputDevice> ListInputDevices()
    {
        using var enumerator = new MMDeviceEnumerator();
        var defaultDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Communications);
        var devices = enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active);

        var results = new List<AudioInputDevice>();
        var index = 0;
        foreach (var device in devices)
        {
            var isDefault = string.Equals(device.ID, defaultDevice.ID, StringComparison.OrdinalIgnoreCase);
            results.Add(new AudioInputDevice
            {
                Id = $"input-{index}",
                Name = device.FriendlyName,
                IsDefault = isDefault
            });
            index++;
        }

        return results;
    }

    public IReadOnlyList<AudioDevice> ListAllDevices()
    {
        using var enumerator = new MMDeviceEnumerator();
        var defaultInput = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Communications);
        var defaultOutput = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);

        var devices = new List<AudioDevice>();

        var inputs = enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active);
        var inputIndex = 0;
        foreach (var device in inputs)
        {
            devices.Add(new AudioDevice
            {
                Id = $"input-{inputIndex}",
                Name = device.FriendlyName,
                Kind = "audioinput",
                IsDefault = string.Equals(device.ID, defaultInput.ID, StringComparison.OrdinalIgnoreCase)
            });
            inputIndex++;
        }

        var outputs = enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active);
        var outputIndex = 0;
        foreach (var device in outputs)
        {
            devices.Add(new AudioDevice
            {
                Id = $"output-{outputIndex}",
                Name = device.FriendlyName,
                Kind = "audiooutput",
                IsDefault = string.Equals(device.ID, defaultOutput.ID, StringComparison.OrdinalIgnoreCase)
            });
            outputIndex++;
        }

        return devices;
    }

    public MMDevice ResolveInputDevice(string? deviceId)
    {
        using var enumerator = new MMDeviceEnumerator();
        var devices = enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active);

        if (!string.IsNullOrWhiteSpace(deviceId) &&
            deviceId.StartsWith("input-", StringComparison.OrdinalIgnoreCase) &&
            int.TryParse(deviceId["input-".Length..], out var index))
        {
            if (index >= 0 && index < devices.Count)
            {
                return devices[index];
            }

            throw new InvalidOperationException($"Requested input device '{deviceId}' is not available.");
        }

        return enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Communications);
    }
}
