namespace Astrolune.Sdk.Services;

/// <summary>
/// Service for secure credential storage.
/// </summary>
public interface IKeyringService
{
    /// <summary>
    /// Retrieves a password stored under the given service/key combination.
    /// </summary>
    Task<string?> GetPasswordAsync(string service, string key, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Stores a password under the given service/key combination.
    /// </summary>
    Task SetPasswordAsync(string service, string key, string password, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Deletes a stored password for the given service/key combination.
    /// </summary>
    Task DeletePasswordAsync(string service, string key, CancellationToken cancellationToken = default);
}
