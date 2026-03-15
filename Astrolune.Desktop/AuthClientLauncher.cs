using System.Diagnostics;

namespace Astrolune.Desktop;

public sealed class AuthClientLauncher
{
    public string BaseUrl { get; }
    public string CallbackScheme { get; }

    public AuthClientLauncher()
    {
        BaseUrl = Environment.GetEnvironmentVariable("ASTROLUNE_AUTH_CLIENT_URL") ?? "http://localhost:5174";
        CallbackScheme = Environment.GetEnvironmentVariable("ASTROLUNE_AUTH_CALLBACK_SCHEME") ?? "astrolune";
    }

    public string BuildAuthUrl(string? mode)
    {
        var normalized = BaseUrl.TrimEnd('/');
        var path = string.Equals(mode, "register", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(mode, "sign-up", StringComparison.OrdinalIgnoreCase)
            ? "/register"
            : "/login";

        var redirectUri = $"{CallbackScheme}://auth/callback";
        var url = $"{normalized}{path}?redirect_uri={Uri.EscapeDataString(redirectUri)}";
        return url;
    }

    public void Open(string? mode)
    {
        var url = BuildAuthUrl(mode);
        Process.Start(new ProcessStartInfo(url)
        {
            UseShellExecute = true
        });
    }
}
