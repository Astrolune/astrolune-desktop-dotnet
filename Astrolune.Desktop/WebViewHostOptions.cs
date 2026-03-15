namespace Astrolune.Desktop;

public sealed record WebViewHostOptions
{
    public required string DevServerUrl { get; init; }
    public required string FrontendFolder { get; init; }
    public required bool UseDevServer { get; init; }
}
