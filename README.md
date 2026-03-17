# Astrolune Desktop

<div align="center">

![Astrolune Logo](https://img.shields.io/badge/Astrolune-Desktop-000000?style=for-the-badge&logo=appveyor)
![Platform](https://img.shields.io/badge/Platform-Windows-000000?style=for-the-badge&logo=windows)
![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?style=for-the-badge&logo=dotnet)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)

**Modern desktop application with modular architecture**

[Features](#features) • [Architecture](#architecture) • [Getting Started](#getting-started) • [Documentation](#documentation) • [License](#license)

</div>

---

## 📖 About

**Astrolune Desktop** is a modern Windows application with a hybrid architecture that combines the power of **.NET/WPF** backend with the flexibility of **React/Vite** frontend. The application provides a modular system with support for dynamically loaded modules, audio/video capture, and integration with LiveKit SFU for real-time communication.

### ✨ Key Features

- 🧩 **Modular Architecture** – dynamically load and update modules
- 🎨 **Modern UI** – React + TypeScript with Material Design
- 📹 **Media Capture** – capture screen, windows, audio and video devices
- 🔐 **Security** – modules signed with cryptographic keys
- 📦 **Auto Updates** – automatic module updates from GitHub
- 🎤 **LiveKit Integration** – real-time audio/video communication

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│            Astrolune.Desktop (WPF)              │
│  ┌──────────────────┐  ┌────────────────────┐  │
│  │  WebViewBridge   │  │  ModuleLoader      │  │
│  │  (WebView2)      │  │  (Dynamic DLLs)    │  │
│  └────────┬─────────┘  └────────┬───────────┘  │
│           │                     │               │
└───────────┼─────────────────────┼───────────────┘
            │                     │
┌───────────┴──────┐  ┌──────────┴──────────────────┐
│                  │  │                             │
│ Astrolune.React  │  │ Astrolune.Core (Contracts) │
│ (Vite + TS)      │  │ - Media Capture            │
│ - Redux Toolkit  │  │ - Module System            │
│ - React Router   │  │ - Keyring Service          │
│ - LiveKit Client │  │ - Event Dispatcher         │
└──────────────────┘  └─────────────────────────────┘
```

### 📦 Project Structure

| Project | Description |
|---------|-------------|
| **Astrolune.Core** | Shared core library (event dispatcher, keyring, storage) |
| **Astrolune.Desktop** | WPF app (UI + module host) |
| **Astrolune.Sdk** | SDK for building modules |
| **Astrolune.React** | Frontend (React + TypeScript) |
| **modules/Astrolune.Core.Module** | Core module (NuGet package) |
| **modules/Astrolune.Media.Module** | Media capture module (NuGet package) |
| **Astrolune.Tests** | Client/host tests |
| **tools/ModuleSigner** | Module signing utility |
| **tools/ModuleManager** | Module management CLI |

---

## 🛠 Getting Started

### Prerequisites

- **.NET 10.0 SDK** or higher
- **Node.js 20+** (for React frontend)
- **Git** (for repository operations)
- **Visual Studio 2022** (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/Astrolune/astrolune-desktop-dotnet.git
cd astrolune-desktop-dotnet

# Install frontend dependencies
cd Astrolune.React
npm install

# Build project
cd ..
dotnet restore
dotnet build -c Release
```

### Development Mode

```bash
# Terminal 1: Start React dev server
cd Astrolune.React
npm run dev

# Terminal 2: Start Desktop application
cd ..
dotnet run -c Debug --project Astrolune.Desktop
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ASTROLUNE_DEV_URL` | Frontend dev server URL | `http://localhost:5173` |
| `ASTROLUNE_USE_DEVSERVER` | Enable dev server (1/0) | Auto |
| `MODULE_PRIVATE_KEY` | Private key for module signing | — |

---

## 📚 Documentation

### Building

```bash
# Build all components
dotnet build -c Release

# Build with tests
dotnet test -c Release

# Publish application
dotnet publish Astrolune.Desktop -c Release -r win-x64 --self-contained -o publish
```

### Module System

Modules are stored in `modules/` directory with the following structure:

```
modules/
├── Astrolune.Core/
│   ├── Astrolune.Core.dll      # Module main file
│   ├── module.manifest.json     # Metadata
│   ├── module.sig               # Cryptographic signature
│   └── Resources/               # Localization files
```

#### Creating a Module

1. Create a project in `modules/`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <AssemblyName>Astrolune.MyModule</AssemblyName>
    <RootNamespace>Astrolune.Modules.MyModule</RootNamespace>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\Astrolune.Sdk\Astrolune.Sdk.csproj" />
  </ItemGroup>
</Project>
```

2. Implement the `IModule` interface:

```csharp
using Astrolune.Sdk.Modules;
using Microsoft.Extensions.DependencyInjection;

namespace Astrolune.Modules.MyModule;

public sealed class MyModule : IModule
{
    public void Register(IServiceCollection services)
    {
        // Service registration
    }

    public void Initialize() { }
    public void Shutdown() { }
}
```

3. Add `module.manifest.json`:

```json
{
  "id": "Astrolune.MyModule",
  "name": "My Module",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Module description",
  "category": "extension",
  "permissions": ["network"],
  "dependencies": [],
  "entryPoint": "Astrolune.Modules.MyModule.MyModule",
  "minHostVersion": "1.0.0",
  "updateRepository": "your-username/your-repo"
}
```

---

## 📦 Publishing to GitHub Packages

### SDK Publishing

To publish `Astrolune.Sdk` to GitHub Packages:

```bash
# Create and push a tag in format: sdk-v<VERSION>
git tag sdk-v1.0.0
git push origin sdk-v1.0.0
```

The workflow will:
1. Extract version from tag (e.g., `1.0.0` from `sdk-v1.0.0`)
2. Pack with version set to `1.0.0`
3. Publish to `https://nuget.pkg.github.com/Astrolune/index.json`

### Module Publishing

To publish modules to GitHub Packages:

```bash
# Publish Core Module
git tag module-core-v1.0.0
git push origin module-core-v1.0.0

# Publish Media Module
git tag module-media-v1.0.0
git push origin module-media-v1.0.0
```

The workflow detects the module from tag, packs it with the correct version, and publishes it.

### Consuming Packages

Configure `nuget.config`:
```xml
<packageSources>
  <add key="github" value="https://nuget.pkg.github.com/Astrolune/index.json" />
</packageSources>
```

Authenticate with GitHub Packages using a Personal Access Token (PAT) with `read:packages` scope.

Install packages:
```bash
dotnet add package Astrolune.Sdk --version 1.0.0
dotnet add package Astrolune.Core.Module --version 1.0.0
dotnet add package Astrolune.Media.Module --version 1.0.0
```

---

## 🔧 Tools

### ModuleSigner

Utility for cryptographic module signing:

```bash
dotnet run --project tools/ModuleSigner/ModuleSigner.csproj -- \
  --manifest "modules/core/module.manifest.json" \
  --dll "modules/core/core.dll" \
  --out "modules/core/module.sig" \
  --private-key "YOUR_PRIVATE_KEY"
```

### ModuleManager

CLI for module management:

```bash
# List modules
dotnet run --project tools/ModuleManager/ModuleManager.csproj -- list

# Module information
dotnet run --project tools/ModuleManager/ModuleManager.csproj -- info --module core

# Verify module
dotnet run --project tools/ModuleManager/ModuleManager.csproj -- verify --module core

# Update modules
dotnet run --project tools/ModuleManager/ModuleManager.csproj -- update --all

# Apply updates
dotnet run --project tools/ModuleManager/ModuleManager.csproj -- apply --module core
```

---

## 🛡️ Security

### Module Signing

All modules are signed using **Ed25519** via **NSec.Cryptography** library. When loading a module:

1. Cryptographic signature is verified
2. Manifest is validated
3. Dependencies are checked
4. User permissions are requested

### Permissions

Modules request permissions through the permissions system:

| Permission | Description |
|------------|-------------|
| `microphone` | Access to microphone |
| `screen` | Screen capture |
| `network` | Network requests |
| `notifications` | Notifications |
| `storage` | Storage access |

---

## 📄 License

```
Copyright © 2026 Astrolune. All rights reserved.

This software and its documentation are proprietary.
Unauthorized copying, distribution, or use is strictly prohibited.
```

---

## 🤝 Contributing

We welcome contributions to the project! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

- **Website**: [astrolune.app](https://astrolune.app)
- **Email**: support@astrolune.app
- **Issues**: [GitHub Issues](https://github.com/Astrolune/astrolune-desktop-dotnet/issues)

---

<div align="center">

**Built with ❤️ using .NET and React**

![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?style=flat-square&logo=dotnet)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?style=flat-square&logo=typescript)
![LiveKit](https://img.shields.io/badge/LiveKit-2.17-44D694?style=flat-square&logo=livekit)

</div>

## Module Bundling (Client)

1. Pack local SDK/core modules:

```powershell
./tools/PrepareLocalPackages.ps1
```

2. Build the client:

```powershell
dotnet build Astrolune.Desktop/Astrolune.Desktop.csproj -c Release
```

3. Bundle modules into the output using JSON config:

- Config: `installer/modules.build.json`
- Script: `tools/BundleModules.ps1`

4. Generate installer module list:

```powershell
./tools/GenerateInstallerModules.ps1 -ConfigPath .\installer\modules.build.json -OutputPath .\installer\installer.modules.iss
```
