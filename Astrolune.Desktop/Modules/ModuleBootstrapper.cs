using System.IO;
using Astrolune.Sdk.Modules;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace Astrolune.Desktop.Modules;

public static class ModuleBootstrapper
{
    public static ModuleLoader ConfigureModules(
        IServiceCollection services,
        ModuleLoaderOptions loaderOptions,
        ModuleUpdateOptions updateOptions)
    {
        var registry = new ModuleRegistry();
        var prompt = new WpfModuleUserPrompt();
        var permissionStore = new ModulePermissionStore(GetPermissionStorePath());
        var permissionService = new ModulePermissionService(permissionStore, prompt);
        var signatureVerifier = new ModuleSignatureVerifier();
        var updateState = new ModuleUpdateStateStore(updateOptions.StatePath ?? GetUpdateStatePath());

        var loader = new ModuleLoader(
            loaderOptions,
            registry,
            signatureVerifier,
            permissionService,
            prompt,
            NullLogger<ModuleLoader>.Instance);

        loader.DiscoverAndRegisterModules(services);

        services.AddSingleton<IModuleRegistry>(registry);
        services.AddSingleton(registry);
        services.AddSingleton<IModuleUserPrompt>(prompt);
        services.AddSingleton(permissionStore);
        services.AddSingleton<IModulePermissionService>(permissionService);
        services.AddSingleton(signatureVerifier);
        services.AddSingleton(updateState);
        services.AddSingleton(loader);
        services.AddSingleton<IHostedService>(sp => sp.GetRequiredService<ModuleLoader>());

        services.AddSingleton(loaderOptions);
        services.AddSingleton(updateOptions);
        services.AddSingleton(new ModuleUpdater(
            updateOptions,
            loaderOptions,
            registry,
            signatureVerifier,
            prompt,
            updateState,
            NullLogger<ModuleUpdater>.Instance));

        return loader;
    }

    private static string GetPermissionStorePath()
    {
        var root = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(root, "Astrolune", "module-permissions.dat");
    }

    private static string GetUpdateStatePath()
    {
        var root = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(root, "Astrolune", "module-updates.json");
    }
}
