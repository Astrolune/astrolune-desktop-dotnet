using System.Security.Cryptography;
using System.Linq;

namespace Astrolune.Core.Services;

/// <summary>
/// Implementation of IKeyringService for secure credential storage.
/// </summary>
public sealed class KeyringService : IKeyringService
{
    private readonly string _storageRoot;

    public KeyringService()
    {
        var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        _storageRoot = Path.Combine(baseDir, "Astrolune", "Keyring");
        Directory.CreateDirectory(_storageRoot);
    }

    /// <inheritdoc />
    public async Task<string?> GetPasswordAsync(string service, string key, CancellationToken cancellationToken = default)
    {
        var path = BuildPath(service, key);
        if (!File.Exists(path))
        {
            return null;
        }

        var encrypted = await File.ReadAllBytesAsync(path, cancellationToken).ConfigureAwait(false);
        var raw = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
        return System.Text.Encoding.UTF8.GetString(raw);
    }

    /// <inheritdoc />
    public async Task SetPasswordAsync(string service, string key, string password, CancellationToken cancellationToken = default)
    {
        var path = BuildPath(service, key);
        var raw = System.Text.Encoding.UTF8.GetBytes(password);
        var encrypted = ProtectedData.Protect(raw, null, DataProtectionScope.CurrentUser);
        await File.WriteAllBytesAsync(path, encrypted, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public Task DeletePasswordAsync(string service, string key, CancellationToken cancellationToken = default)
    {
        var path = BuildPath(service, key);
        if (File.Exists(path))
        {
            File.Delete(path);
        }

        return Task.CompletedTask;
    }

    private string BuildPath(string service, string key)
    {
        var safeService = Sanitize(service);
        var safeKey = Sanitize(key);
        return Path.Combine(_storageRoot, $"{safeService}__{safeKey}.bin");
    }

    private static string Sanitize(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var buffer = value.ToCharArray();
        for (var i = 0; i < buffer.Length; i++)
        {
            if (invalid.Contains(buffer[i]))
            {
                buffer[i] = '_';
            }
        }

        return new string(buffer);
    }
}
