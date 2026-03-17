using Astrolune.Sdk.Modules;

namespace Astrolune.Desktop.Modules;

public interface IModuleUserPrompt
{
    bool ConfirmUnsignedModule(ModuleManifest manifest);
    bool RequestPermissions(ModuleManifest manifest, IReadOnlyCollection<string> permissions);
    void NotifyUpdateReady(ModuleManifest manifest, Version version);
}
