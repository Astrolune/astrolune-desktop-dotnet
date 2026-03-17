using System.Reflection;
using System.Runtime.Loader;

namespace Astrolune.Desktop.Modules;

public sealed class ModuleLoadContext : AssemblyLoadContext
{
    private readonly AssemblyDependencyResolver _resolver;
    private readonly HashSet<string> _sharedAssemblyNames;

    public ModuleLoadContext(string mainAssemblyPath, IEnumerable<string> sharedAssemblyNames)
        : base(isCollectible: false)
    {
        _resolver = new AssemblyDependencyResolver(mainAssemblyPath);
        _sharedAssemblyNames = new HashSet<string>(sharedAssemblyNames, StringComparer.OrdinalIgnoreCase);
    }

    protected override Assembly? Load(AssemblyName assemblyName)
    {
        if (assemblyName.Name is null)
        {
            return null;
        }

        if (_sharedAssemblyNames.Contains(assemblyName.Name))
        {
            return AssemblyLoadContext.Default.Assemblies
                .FirstOrDefault(assembly => string.Equals(assembly.GetName().Name, assemblyName.Name, StringComparison.OrdinalIgnoreCase));
        }

        var path = _resolver.ResolveAssemblyToPath(assemblyName);
        if (path is not null)
        {
            return LoadFromAssemblyPath(path);
        }

        return null;
    }

    protected override IntPtr LoadUnmanagedDll(string unmanagedDllName)
    {
        var path = _resolver.ResolveUnmanagedDllToPath(unmanagedDllName);
        if (path is not null)
        {
            return LoadUnmanagedDllFromPath(path);
        }

        return IntPtr.Zero;
    }
}
