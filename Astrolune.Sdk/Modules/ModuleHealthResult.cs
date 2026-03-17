namespace Astrolune.Sdk.Modules;

/// <summary>
/// Module health check result.
/// </summary>
public sealed record ModuleHealthResult
{
    /// <summary>
    /// Module ID.
    /// </summary>
    public required string ModuleId { get; init; }
    
    /// <summary>
    /// Health status.
    /// </summary>
    public required ModuleHealthStatus Status { get; init; }
    
    /// <summary>
    /// Health check message.
    /// </summary>
    public string? Message { get; init; }
}
