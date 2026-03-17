using System.IO;
using System.Text.Json;

namespace Astrolune.Desktop.Modules;

public sealed class ModuleUpdateStateStore
{
    private readonly string _path;
    private readonly object _sync = new();
    private Dictionary<string, DateTimeOffset> _lastChecks;

    public ModuleUpdateStateStore(string path)
    {
        _path = path;
        _lastChecks = Load();
    }

    public bool ShouldCheck(string moduleId, TimeSpan interval, DateTimeOffset now)
    {
        lock (_sync)
        {
            return !_lastChecks.TryGetValue(moduleId, out var last) || now - last >= interval;
        }
    }

    public void MarkChecked(string moduleId, DateTimeOffset timestamp)
    {
        lock (_sync)
        {
            _lastChecks[moduleId] = timestamp;
            Save();
        }
    }

    private Dictionary<string, DateTimeOffset> Load()
    {
        try
        {
            if (!File.Exists(_path))
            {
                return new Dictionary<string, DateTimeOffset>(StringComparer.OrdinalIgnoreCase);
            }

            var json = File.ReadAllText(_path);
            var data = JsonSerializer.Deserialize<Dictionary<string, DateTimeOffset>>(json);
            return data ?? new Dictionary<string, DateTimeOffset>(StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            return new Dictionary<string, DateTimeOffset>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private void Save()
    {
        var directory = Path.GetDirectoryName(_path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var json = JsonSerializer.Serialize(_lastChecks, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(_path, json);
    }
}
