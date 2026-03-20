param(
    [string]$Configuration = "Release"
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$packagesDir = Join-Path $repoRoot ".packages"
New-Item -ItemType Directory -Path $packagesDir -Force | Out-Null

Write-Host "Restoring solution packages..." -ForegroundColor Cyan
dotnet restore (Join-Path $repoRoot "Astrolune.sln")

Write-Host "Restoring module packages..." -ForegroundColor Cyan
dotnet restore (Join-Path $repoRoot "tools\\ModulePackages\\ModulePackages.csproj")

$globalPackages = $env:NUGET_PACKAGES
if ([string]::IsNullOrWhiteSpace($globalPackages)) {
    $globalPackages = Join-Path $env:USERPROFILE ".nuget\\packages"
}

$packages = @(
    @{ Id = "Astrolune.Sdk"; Version = "1.0.0" },
    @{ Id = "Astrolune.Core.Module"; Version = "1.0.0" },
    @{ Id = "Astrolune.Media.Module"; Version = "1.0.0" },
    @{ Id = "Astrolune.Auth.Module"; Version = "1.0.0" }
)

foreach ($pkg in $packages) {
    $idLower = $pkg.Id.ToLowerInvariant()
    $nupkg = Join-Path $globalPackages $idLower
    $nupkg = Join-Path $nupkg $pkg.Version
    $nupkg = Join-Path $nupkg ("$idLower.$($pkg.Version).nupkg")

    if (-not (Test-Path $nupkg)) {
        Write-Host "Package not found in global cache: $($pkg.Id) $($pkg.Version)" -ForegroundColor Yellow
        continue
    }

    Copy-Item -Path $nupkg -Destination $packagesDir -Force
}
