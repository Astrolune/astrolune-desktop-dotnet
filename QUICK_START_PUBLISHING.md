# Quick Start Guide: Publishing Astrolune Packages

## рџљЂ One-Minute Workflow

### To publish SDK v1.0.0:
```bash
git tag sdk-v1.0.0
git push origin sdk-v1.0.0
```

### To publish Core Module v1.0.0:
```bash
git tag module-core-v1.0.0
git push origin module-core-v1.0.0
```

### To publish Media Module v1.0.0:
```bash
git tag module-media-v1.0.0
git push origin module-media-v1.0.0
```

### To publish Auth Module v1.0.0:
```bash
git tag module-auth-v1.0.0
git push origin module-auth-v1.0.0
```

That's it! The workflows handle the rest automatically.

## вњ… What Happens Automatically

1. GitHub detects the tag push
2. Workflow extracts version from tag name
3. Runs `dotnet pack` with correct version
4. Publishes to `https://nuget.pkg.github.com/Astrolune/index.json`
5. Available in Packages section

## Project Structure

Main repo:
- `astrolune-desktop-dotnet` (desktop app, frontend, tools)

Separate repos:
- `astrolune-sdk`
- `astrolune-core-module`
- `astrolune-media-module`
- `astrolune-auth-module`

## Complete Publishing Examples

### Example 1: Release SDK 1.2.3

```bash
# Before: Update version in Astrolune.Sdk/Astrolune.Sdk.csproj (optional)
# <PackageVersion>1.2.3</PackageVersion>

# Create and push tag
git tag sdk-v1.2.3
git push origin sdk-v1.2.3

# вњ… Automatic:
# - Workflow extracts version "1.2.3"
# - Packs Astrolune.Sdk with version 1.2.3
# - Publishes to GitHub Packages
# - Creates Release "SDK 1.2.3"
# - Available at https://github.com/Astrolune/astrolune-desktop-dotnet/releases/tag/sdk-v1.2.3
```

### Example 2: Release Multiple Modules (One at a Time)

```bash
# Release Core Module 2.0.0
git tag module-core-v2.0.0
git push origin module-core-v2.0.0

# Wait for workflow to complete (~2 minutes)
# Check at: https://github.com/Astrolune/astrolune-desktop-dotnet/actions

# Release Media Module 1.5.0
git tag module-media-v1.5.0
git push origin module-media-v1.5.0

# вњ… Each publishes independently
```

### Example 3: Pre-release Version

```bash
git tag sdk-v1.0.0-beta1
git push origin sdk-v1.0.0-beta1

# Creates package version: 1.0.0-beta1
# Marked as pre-release in GitHub Packages
```

## рџ“Ґ Consuming Published Packages

### Step 1: Create nuget.config

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="github" value="https://nuget.pkg.github.com/Astrolune/index.json" />
  </packageSources>
  <packageSourceCredentials>
    <github>
      <add key="Username" value="YOUR_USERNAME" />
      <add key="ClearTextPassword" value="YOUR_GITHUB_TOKEN" />
    </github>
  </packageSourceCredentials>
</configuration>
```

### Step 2: Install Package

```bash
# Install specific version
dotnet add package Astrolune.Sdk --version 1.2.3

# Or let it pick latest
dotnet add package Astrolune.Sdk
```

## рџ”Ќ Monitoring Workflows

1. Go to: `https://github.com/Astrolune/astrolune-desktop-dotnet/actions`
2. Look for "Publish SDK" or "Publish Modules"
3. Click on recent run to see detailed logs
4. Green checkmark = success вњ…
5. Red X = failure вќЊ

## рџђ› Common Issues

| Issue | Solution |
|-------|----------|
| Workflow doesn't trigger | Check tag format: `sdk-v1.0.0`, `module-core-v1.0.0` |
| Package not found | Wait 5 minutes after workflow completes, then refresh |
| Auth error | Verify GitHub token has `read:packages` and `write:packages` scopes |
| Already exists | Workflows automatically skip with `--skip-duplicate` |

## рџ“љ See Also

- `README.md` - Main project documentation
- `PUBLISHING_GUIDE.md` - Detailed publishing guide
- `.github/workflows/publish-sdk.yml` - SDK workflow source
- `.github/workflows/publish-modules.yml` - Modules workflow source
- `Astrolune.Sdk/README.md` - SDK documentation
