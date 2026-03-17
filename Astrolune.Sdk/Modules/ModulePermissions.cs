namespace Astrolune.Sdk.Modules;

/// <summary>
/// Module permissions definition.
/// </summary>
public static class ModulePermissions
{
    public const string Network = "network";
    public const string FileSystem = "filesystem";
    public const string NativeMessaging = "native-messaging";
    public const string SystemTray = "system-tray";

    private static readonly HashSet<string> Known = new(StringComparer.OrdinalIgnoreCase)
    {
        Network,
        FileSystem,
        NativeMessaging,
        SystemTray
    };

    public static bool IsKnown(string? permission)
    {
        return !string.IsNullOrWhiteSpace(permission) && Known.Contains(permission);
    }
}
