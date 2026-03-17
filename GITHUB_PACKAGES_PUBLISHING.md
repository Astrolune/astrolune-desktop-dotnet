# Publishing Packages to GitHub Packages

This guide explains how to publish NuGet packages to GitHub Packages registry.

## Step 1: Create a Personal Access Token (PAT)

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Set the token name: `Astrolune Package Publishing`
4. Select these scopes:
   - ✅ `write:packages` - required for publishing
   - ✅ `read:packages` - required for reading
   - ✅ `delete:packages` - optional, for managing versions
   - ✅ `repo` - optional, if using private repositories

5. Click "Generate token"
6. **Copy the token immediately** - you won't see it again!

## Step 2: Publish Packages

### Method 1: Using PowerShell Script (Recommended)

```powershell
# Run the publishing script with your token
.\publish-packages.ps1 -Token "ghp_your_token_here"
```

The script will:
- Publish Media Module
- Publish Core Module
- Publish SDK
- Show results for each package

### Method 2: Manual Publishing

Publish each package individually:

```bash
# Set your token (replace with your PAT)
$TOKEN = "ghp_your_token_here"

# Publish Media Module
dotnet nuget push artifacts/Astrolune.Media.Module.1.0.0.nupkg `
  --source "https://nuget.pkg.github.com/Astrolune/astrolune-desktop-dotnet/index.json" `
  --api-key $TOKEN `
  --skip-duplicate

# Publish Core Module
dotnet nuget push artifacts/Astrolune.Core.Module.1.0.0.nupkg `
  --source "https://nuget.pkg.github.com/Astrolune/astrolune-desktop-dotnet/index.json" `
  --api-key $TOKEN `
  --skip-duplicate

# Publish SDK
dotnet nuget push artifacts/Astrolune.Sdk.1.0.0.nupkg `
  --source "https://nuget.pkg.github.com/Astrolune/astrolune-desktop-dotnet/index.json" `
  --api-key $TOKEN `
  --skip-duplicate
```

### Method 3: Using nuget.config

1. Edit `publish-nuget.config` and replace `PASTE_YOUR_GITHUB_TOKEN_HERE` with your token
2. Run:
```bash
dotnet nuget push artifacts/*.nupkg `
  --source "https://nuget.pkg.github.com/Astrolune/astrolune-desktop-dotnet/index.json" `
  --skip-duplicate `
  --configfile publish-nuget.config
```

## Step 3: Verify Packages Were Published

Check GitHub Packages:
https://github.com/Astrolune/astrolune-desktop-dotnet/packages

You should see:
- ✅ Astrolune.Sdk
- ✅ Astrolune.Core.Module
- ✅ Astrolune.Media.Module

## Consuming Published Packages

Once published, users can install packages:

```bash
# Create nuget.config in their project
# Add GitHub Packages source
# Install packages
dotnet add package Astrolune.Sdk --version 1.0.0
dotnet add package Astrolune.Core.Module --version 1.0.0
dotnet add package Astrolune.Media.Module --version 1.0.0
```

## Troubleshooting

### "Forbidden (403)" Error
- ✅ Verify token has `write:packages` scope
- ✅ Verify token hasn't expired
- ✅ Verify organization is "Astrolune" (case-sensitive)

### "Conflict (409)" Error
- This means package already exists
- If republishing new version, increment version in .csproj
- The `--skip-duplicate` flag prevents errors if version exists

### Token Scopes Not Correct
Go to https://github.com/settings/tokens to view/modify token scopes

## Automated Publishing (GitHub Actions)

When you push tags, GitHub Actions automatically publishes:
- `sdk-v1.0.0` → publishes SDK via publish-sdk.yml
- `module-core-v1.0.0` → publishes Core Module via publish-modules.yml
- `module-media-v1.0.0` → publishes Media Module via publish-modules.yml

The workflows use `${{ secrets.GITHUB_TOKEN }}` which is automatically provided by GitHub Actions.

## Security Notes

⚠️ **Never commit tokens to git!**
- `publish-nuget.config` should NOT be committed (it's in .gitignore)
- Use environment variables or secure token management
- Store tokens in GitHub Secrets for CI/CD workflows

## Related Documentation

- `QUICK_START_PUBLISHING.md` - Quick reference
- `PUBLISHING_GUIDE.md` - Detailed guide
- `PACKAGE_STATUS_v1.0.0.md` - Current package status
