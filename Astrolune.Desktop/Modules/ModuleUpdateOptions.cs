namespace Astrolune.Desktop.Modules;

public sealed class ModuleUpdateOptions
{
    public bool IsEnabled { get; init; } = true;
    public TimeSpan CheckInterval { get; init; } = TimeSpan.FromHours(1);
    public string? StatePath { get; init; }
    public int MaxParallelRequests { get; init; } = 4;
}
