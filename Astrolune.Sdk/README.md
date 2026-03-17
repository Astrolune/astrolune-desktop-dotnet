# Astrolune.Sdk

[![NuGet](https://img.shields.io/nuget/v/Astrolune.Sdk.svg)](https://www.nuget.org/packages/Astrolune.Sdk)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The official SDK for building Astrolune Desktop modules. Provides interfaces and models for creating extensible modules.

## Installation

Install via NuGet Package Manager:

```powershell
Install-Package Astrolune.Sdk
```

Or via .NET CLI:

```bash
dotnet add package Astrolune.Sdk
```

## Usage

### Creating a Module

1. Create a new .NET class library targeting `net10.0-windows10.0.19041.0`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0-windows10.0.19041.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Astrolune.Sdk" Version="1.0.0" />
  </ItemGroup>
</Project>
```

2. Implement the `IModule` interface:

```csharp
using Astrolune.Sdk.Modules;
using Microsoft.Extensions.DependencyInjection;

namespace MyModule;

public class MyModule : IModule
{
    public void Register(IServiceCollection services)
    {
        // Register your services
        services.AddSingleton<IMyService, MyService>();
    }

    public void Initialize()
    {
        // Initialize your module
    }

    public void Shutdown()
    {
        // Cleanup resources
    }
}
```

3. Create a `module.manifest.json`:

```json
{
  "id": "MyModule",
  "name": "My Module",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "My awesome module",
  "category": "extension",
  "dependencies": [],
  "entryPoint": "MyModule.MyModule",
  "minHostVersion": "1.0.0",
  "minSdkVersion": "1.0.0",
  "signature": "ed25519-sha256",
  "updateRepository": "your-org/your-module",
  "buildConfiguration": "standalone"
}
```

## Available Services

### IEventDispatcher

Emit events to the frontend:

```csharp
public class MyService
{
    private readonly IEventDispatcher _dispatcher;

    public MyService(IEventDispatcher dispatcher)
    {
        _dispatcher = dispatcher;
    }

    public async Task NotifyAsync(string message)
    {
        await _dispatcher.EmitAsync("notification", new { message });
    }
}
```

### ICaptureService

Screen and audio capture:

```csharp
public class CaptureService
{
    private readonly ICaptureService _capture;

    public CaptureService(ICaptureService capture)
    {
        _capture = capture;
    }

    public async Task StartScreenShareAsync()
    {
        var sources = await _capture.GetCaptureSourcesAsync();
        var sessionId = await _capture.StartScreenCaptureAsync(new ScreenCaptureRequest());
    }
}
```

### IMediaService

LiveKit integration for voice/video:

```csharp
public class VoiceService
{
    private readonly IMediaService _media;

    public VoiceService(IMediaService media)
    {
        _media = media;
    }

    public async Task ConnectAsync(string url, string token)
    {
        await _media.ConnectLivekitAsync(new ConnectLivekitRequest
        {
            LivekitUrl = url,
            Token = token
        });
        await _media.StartVoiceAsync(new StartVoiceRequest());
    }
}
```

### IKeyringService

Secure credential storage:

```csharp
public class AuthService
{
    private readonly IKeyringService _keyring;

    public AuthService(IKeyringService keyring)
    {
        _keyring = keyring;
    }

    public async Task StoreTokenAsync(string token)
    {
        await _keyring.SetPasswordAsync("auth", "token", token);
    }

    public async Task<string?> GetTokenAsync()
    {
        return await _keyring.GetPasswordAsync("auth", "token");
    }
}
```

## Build Configurations

Modules can be configured to build in different modes:

| Configuration | Description |
|--------------|-------------|
| `bundled` | Built together with the main client |
| `standalone` | Built and distributed separately |
| `none` | Not built (development only) |

Set in your `.csproj`:

```xml
<PropertyGroup>
  <ModuleBuildConfiguration>bundled</ModuleBuildConfiguration>
</PropertyGroup>
```

## Module Lifecycle

1. **Register**: Services are registered in the DI container
2. **Initialize**: Module is initialized after all services are registered
3. **Running**: Module is active and handling requests
4. **Shutdown**: Module is shutting down and should release resources

## Testing

Use the provided interfaces for unit testing:

```csharp
using NSubstitute;

[Fact]
public void MyService_EmitsEvent()
{
    var dispatcher = Substitute.For<IEventDispatcher>();
    var service = new MyService(dispatcher);

    service.NotifyAsync("test");

    dispatcher.Received().EmitAsync("notification", Arg.Any<object>(), default);
}
```

## Documentation

- [Main Repository](https://github.com/Ankerin/astrolune-desktop-dotnet)
- [Module Development Guide](https://github.com/Ankerin/astrolune-desktop-dotnet/blob/main/MODULES.md)

## License

This project is licensed under the [MIT License](LICENSE).
