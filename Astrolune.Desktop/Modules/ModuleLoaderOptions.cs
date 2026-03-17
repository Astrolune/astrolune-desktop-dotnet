namespace Astrolune.Desktop.Modules;

public sealed class ModuleLoaderOptions
{
    public string ModulesRoot { get; init; } = string.Empty;
    public Version HostVersion { get; init; } = new(1, 0, 0, 0);
    public Version SdkVersion { get; init; } = new(1, 0, 0, 0);
    public TimeSpan HealthCheckInterval { get; init; } = TimeSpan.FromMinutes(1);
}
