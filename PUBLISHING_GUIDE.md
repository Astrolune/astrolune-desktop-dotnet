# NuGet Package Publishing Guide

This guide explains how to publish Astrolune packages to GitHub Packages.

## Overview

The project has 3 main components that are published as NuGet packages:

1. **Astrolune.SDK** - Public API and interfaces for module development
2. **Astrolune.Core.Module** - Core module (bundled with desktop app)
3. **Astrolune.Media.Module** - Media capture module (separate NuGet package)

## Publishing Workflows

### 1. Publishing the SDK

The SDK provides interfaces and models for module development.

**To publish:**

```bash
# Create a tag in format sdk-v<VERSION>
git tag sdk-v1.0.0
git push origin sdk-v1.0.0
```

**What happens:**

- The `publish-sdk.yml` workflow is triggered
- Workflow extracts version `1.0.0` from tag `sdk-v1.0.0`
- Runs `dotnet pack` with `-p:PackageVersion=1.0.0`
- Publishes to GitHub Packages: `https://nuget.pkg.github.com/Astrolune/astrolune-desktop-dotnet/index.json`

**Example releases:**
- `sdk-v1.0.0` → Package version `1.0.0`
- `sdk-v2.1.5` → Package version `2.1.5`
- `sdk-v1.0.0-beta1` → Package version `1.0.0-beta1`

### 2. Publishing Core Module

The Core Module contains core services implementation.

**To publish:**

```bash
# Create a tag in format module-core-v<VERSION>
git tag module-core-v1.0.0
git push origin module-core-v1.0.0
```

**What happens:**

- The `publish-modules.yml` workflow is triggered
- Workflow detects `module-core` tag and extracts version `1.0.0`
- Builds and packs only `modules/Astrolune.Core.Module/Astrolune.Core.Module.csproj`
- Publishes as `Astrolune.Core.Module` version `1.0.0`
- Creates a GitHub Release with the name "Core Module 1.0.0"

### 3. Publishing Media Module

The Media Module contains media capture and audio processing.

**To publish:**

```bash
# Create a tag in format module-media-v<VERSION>
git tag module-media-v1.0.0
git push origin module-media-v1.0.0
```

**What happens:**

- The `publish-modules.yml` workflow is triggered
- Workflow detects `module-media` tag and extracts version `1.0.0`
- Builds and packs only `modules/Astrolune.Media.Module/Astrolune.Media.Module.csproj`
- Publishes as `Astrolune.Media.Module` version `1.0.0`
- Creates a GitHub Release with the name "Media Module 1.0.0"

## Using Published Packages

### Step 1: Configure NuGet Sources

Create or update `nuget.config` in your project:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="github" value="https://nuget.pkg.github.com/Astrolune/astrolune-desktop-dotnet/index.json" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
  <packageSourceCredentials>
    <github>
      <add key="Username" value="YOUR_USERNAME" />
      <add key="ClearTextPassword" value="YOUR_GITHUB_TOKEN" />
    </github>
  </packageSourceCredentials>
</configuration>
```

### Step 2: Create GitHub Personal Access Token (PAT)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes: `read:packages`, `write:packages`
4. Copy the token (save it securely)

### Step 3: Install Packages

```bash
# Install SDK
dotnet add package Astrolune.Sdk --version 1.0.0

# Install Core Module (if needed as dependency)
dotnet add package Astrolune.Core.Module --version 1.0.0

# Install Media Module (if needed as dependency)
dotnet add package Astrolune.Media.Module --version 1.0.0
```

### Alternative: Using Environment Variables

```bash
# Linux/macOS
export GITHUB_TOKEN=your_token_here
dotnet add package Astrolune.Sdk --version 1.0.0

# Windows PowerShell
$env:GITHUB_TOKEN = "your_token_here"
dotnet add package Astrolune.Sdk --version 1.0.0

# Windows Command Prompt
set GITHUB_TOKEN=your_token_here
dotnet add package Astrolune.Sdk --version 1.0.0
```

## Workflow Details

### Tag Format Rules

The workflows use git tags to trigger publishing:

| Pattern | Component | Trigger |
|---------|-----------|---------|
| `sdk-v*` | Astrolune.SDK | Push tag starting with `sdk-v` |
| `module-core-v*` | Astrolune.Core.Module | Push tag starting with `module-core-v` |
| `module-media-v*` | Astrolune.Media.Module | Push tag starting with `module-media-v` |

### Version Extraction Logic

The workflows extract versions using regex:

**SDK:**
```powershell
$tag = "sdk-v1.0.0"
$version = $tag -replace "sdk-v", ""  # Result: "1.0.0"
```

**Modules:**
```powershell
if ($tag -match "^module-core-v(.+)$") {
    $module = "core"
    $version = $matches[1]  # Result: "1.0.0"
}
```

### Error Handling

The workflows include error detection:

- If no `.nupkg` files are generated → Workflow fails with error message
- If `dotnet nuget push` fails → Workflow logs error and fails
- If tag format is invalid → Module publishing workflow fails safely

### GitHub Releases

Automatically created for each publication:

- **SDK Release:** Tag = `sdk-v1.0.0`, Title = "SDK 1.0.0", Body = "Published Astrolune.Sdk version 1.0.0 to GitHub Packages"
- **Core Module Release:** Tag = `module-core-v1.0.0`, Title = "Core Module 1.0.0"
- **Media Module Release:** Tag = `module-media-v1.0.0`, Title = "Media Module 1.0.0"

## Best Practices

### 1. Version Numbering

Use semantic versioning:
- `MAJOR.MINOR.PATCH` (e.g., `1.0.0`, `1.2.3`)
- Pre-releases: `1.0.0-beta1`, `1.0.0-rc1`
- Use consistent versioning across related packages

### 2. Testing Before Publishing

```bash
# Always test locally first
dotnet build -c Release
dotnet test -c Release

# Test packing locally
dotnet pack Astrolune.Sdk -c Release -o ./test-artifacts -p:PackageVersion=1.0.0

# Verify package contents
unzip -l test-artifacts/Astrolune.Sdk.1.0.0.nupkg
```

### 3. Keep Changelog

Maintain a `CHANGELOG.md` describing changes in each version.

### 4. Pin Versions

When consuming packages, pin to specific versions in `.csproj`:

```xml
<ItemGroup>
  <PackageReference Include="Astrolune.Sdk" Version="1.0.0" />
  <PackageReference Include="Astrolune.Core.Module" Version="1.0.0" />
</ItemGroup>
```

## Troubleshooting

### "No packages found in artifacts directory"

**Cause:** `dotnet pack` didn't create a `.nupkg` file

**Solution:**
- Check `.csproj` file has `<PackageId>` property
- Verify `<Version>` or `-p:PackageVersion` is set
- Run locally: `dotnet pack <project> -c Release -o artifacts`

### "Failed to push package"

**Cause:** Authentication failed or package already exists

**Solution:**
- Verify GITHUB_TOKEN is valid and has `write:packages` scope
- If package exists, use `--skip-duplicate` (workflows do this automatically)
- Check GitHub Packages settings for the repository

### "Tag format doesn't match"

**Cause:** Tag doesn't follow expected pattern

**Solution:**
- For SDK: use `sdk-v` prefix, not `v` or `sdk-`
- For modules: use `module-core-v` or `module-media-v` prefix
- Example: `sdk-v1.0.0` ✓, `v1.0.0` ✗, `sdk-1.0.0` ✗

## Monitoring Workflows

View workflow status:

1. Go to GitHub repository
2. Click "Actions" tab
3. Look for "Publish SDK" or "Publish Modules" workflows
4. Click on recent runs to see logs

## Related Documentation

- [README.md](./README.md#-publishing-to-github-packages) - Publishing section
- [.github/workflows/publish-sdk.yml](./.github/workflows/publish-sdk.yml)
- [.github/workflows/publish-modules.yml](./.github/workflows/publish-modules.yml)
- [Astrolune.Sdk/README.md](./Astrolune.Sdk/README.md) - SDK documentation
