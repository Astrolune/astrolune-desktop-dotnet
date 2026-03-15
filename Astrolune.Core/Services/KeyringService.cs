using System.Security.Cryptography;
using System.Linq;

namespace Astrolune.Core.Services;

public sealed class KeyringService
{
    private readonly string _storageRoot;

    public KeyringService()
    {
        var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        _storageRoot = Path.Combine(baseDir, "Astrolune", "Keyring");
        Directory.CreateDirectory(_storageRoot);
    }

    /// <summary>
    /// Retrieves a password stored under the given service/key combination.
    /// </summary>
    public Task<string?> GetPasswordAsync(string service, string key)
    {
        var path = BuildPath(service, key);
        if (!File.Exists(path))
        {
            return Task.FromResult<string?>(null);
        }

        var encrypted = File.ReadAllBytes(path);
        var raw = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
        return Task.FromResult<string?>(System.Text.Encoding.UTF8.GetString(raw));
    }

    /// <summary>
    /// Stores a password under the given service/key combination.
    /// </summary>
    public Task SetPasswordAsync(string service, string key, string password)
    {
        var path = BuildPath(service, key);
        var raw = System.Text.Encoding.UTF8.GetBytes(password);
        var encrypted = ProtectedData.Protect(raw, null, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(path, encrypted);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Deletes a stored password for the given service/key combination.
    /// </summary>
    public Task DeletePasswordAsync(string service, string key)
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
