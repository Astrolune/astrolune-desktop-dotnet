#!/usr/bin/env pwsh
# Скрипт для публикации пакетов в GitHub Packages
# Использование: .\publish-packages.ps1 -Token "your_github_pat_token"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token,

    [string]$PackageDir = "artifacts",
    [string]$Source = "https://nuget.pkg.github.com/Astrolune/index.json"
)

$packages = @(
    "Astrolune.Media.Module.1.0.0.nupkg",
    "Astrolune.Core.Module.1.0.0.nupkg",
    "Astrolune.Sdk.1.0.0.nupkg"
)

Write-Host "📦 Publishing packages to GitHub Packages..." -ForegroundColor Green
Write-Host "Registry: $Source" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($pkg in $packages) {
    $pkgPath = Join-Path $PackageDir $pkg

    if (-not (Test-Path $pkgPath)) {
        Write-Host "❌ Package not found: $pkg" -ForegroundColor Red
        $failCount++
        continue
    }

    Write-Host "Publishing: $pkg" -ForegroundColor Yellow

    try {
        dotnet nuget push $pkgPath `
            --source $Source `
            --api-key $Token `
            --skip-duplicate

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Successfully published: $pkg" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "❌ Failed to publish: $pkg" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host "❌ Error publishing $pkg : $_" -ForegroundColor Red
        $failCount++
    }

    Write-Host ""
}

Write-Host "=" * 60
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "✅ Successful: $successCount" -ForegroundColor Green
Write-Host "❌ Failed: $failCount" -ForegroundColor Red
Write-Host "=" * 60

if ($failCount -eq 0) {
    Write-Host "`n🎉 All packages published successfully!" -ForegroundColor Green
    Write-Host "`n📍 View packages at:" -ForegroundColor Cyan
    Write-Host "https://github.com/Astrolune/astrolune-desktop-dotnet/packages" -ForegroundColor Blue
    exit 0
} else {
    Write-Host "`n⚠️  Some packages failed to publish" -ForegroundColor Yellow
    exit 1
}
