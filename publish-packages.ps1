#!/usr/bin/env pwsh
# Script for publishing packages to GitHub Packages
# Usage: powershell -ExecutionPolicy Bypass -File .\publish-packages.ps1 -Token "your_github_pat_token"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token,

    [string]$PackageDir = "artifacts",
    [string]$Source = "https://nuget.pkg.github.com/Astrolune/index.json"
)

$packages = @(
    "Astrolune.Media.Module.1.0.0.nupkg",
    "Astrolune.Auth.Module.1.0.0.nupkg",
    "Astrolune.Core.Module.1.0.0.nupkg",
    "Astrolune.Sdk.1.0.0.nupkg"
)

Write-Host "Publishing packages to GitHub Packages..." -ForegroundColor Green
Write-Host "Registry: $Source" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($pkg in $packages) {
    $pkgPath = Join-Path $PackageDir $pkg

    if (-not (Test-Path $pkgPath)) {
        Write-Host "[FAIL] Package not found: $pkg" -ForegroundColor Red
        $failCount++
        continue
    }

    Write-Host "[INFO] Publishing: $pkg" -ForegroundColor Yellow

    try {
        dotnet nuget push $pkgPath `
            --source $Source `
            --api-key $Token `
            --skip-duplicate

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Successfully published: $pkg" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "[FAIL] Failed to publish: $pkg" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host "[ERROR] Error publishing $pkg : $_" -ForegroundColor Red
        $failCount++
    }

    Write-Host ""
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "[OK] Successful: $successCount" -ForegroundColor Green
Write-Host "[FAIL] Failed: $failCount" -ForegroundColor Red
Write-Host "============================================================" -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host ""
    Write-Host "All packages published successfully!" -ForegroundColor Green
    Write-Host "View packages at:" -ForegroundColor Cyan
    Write-Host "https://github.com/Astrolune/astrolune-desktop-dotnet/packages" -ForegroundColor Blue
    exit 0
} else {
    Write-Host ""
    Write-Host "Some packages failed to publish" -ForegroundColor Yellow
    exit 1
}
