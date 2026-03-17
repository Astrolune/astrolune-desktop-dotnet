using System.Text.Json;

namespace Astrolune.Core.Module.Services;

public sealed class CoreDataStore
{
    private readonly string _root;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };
    private readonly Dictionary<string, object> _cache = new(StringComparer.OrdinalIgnoreCase);

    public CoreDataStore()
    {
        _root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Astrolune",
            "modules",
            "Astrolune.Core.Module");
    }

    public async Task<T> LoadAsync<T>(string fileName, T fallback, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_cache.TryGetValue(fileName, out var cached) && cached is T cachedTyped)
            {
                return cachedTyped;
            }

            var path = Path.Combine(_root, fileName);
            if (!File.Exists(path))
            {
                _cache[fileName] = fallback!;
                return fallback;
            }

            var json = await File.ReadAllTextAsync(path, cancellationToken).ConfigureAwait(false);
            var result = JsonSerializer.Deserialize<T>(json, _jsonOptions) ?? fallback;
            _cache[fileName] = result!;
            return result;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SaveAsync<T>(string fileName, T payload, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            Directory.CreateDirectory(_root);
            var path = Path.Combine(_root, fileName);
            var json = JsonSerializer.Serialize(payload, _jsonOptions);
            await File.WriteAllTextAsync(path, json, cancellationToken).ConfigureAwait(false);
            _cache[fileName] = payload!;
        }
        finally
        {
            _gate.Release();
        }
    }
}
