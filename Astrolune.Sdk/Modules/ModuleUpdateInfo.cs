namespace Astrolune.Sdk.Modules;

/// <summary>
/// Module update information.
/// </summary>
public sealed record ModuleUpdateInfo
{
    /// <summary>
    /// Module ID.
    /// </summary>
    public required string ModuleId { get; init; }
    
    /// <summary>
    /// Current version.
    /// </summary>
    public required string CurrentVersion { get; init; }
    
    /// <summary>
    /// Available version.
    /// </summary>
    public required string AvailableVersion { get; init; }
    
    /// <summary>
    /// Download URL.
    /// </summary>
    public required string DownloadUrl { get; init; }
    
    /// <summary>
    /// Release notes.
    /// </summary>
    public string? ReleaseNotes { get; init; }
}
