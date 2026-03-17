param(
    [string]$Configuration = "Release"
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$packagesDir = Join-Path $repoRoot ".packages"
New-Item -ItemType Directory -Path $packagesDir -Force | Out-Null

$SdkProject = Join-Path $repoRoot "Astrolune.Sdk\Astrolune.Sdk.csproj"
if (Test-Path $SdkProject) {
    dotnet pack $SdkProject -c $Configuration -o $packagesDir
}

$coreModuleProject = Join-Path $repoRoot "modules\Astrolune.Core.Module\Astrolune.Core.Module.csproj"
if (Test-Path $coreModuleProject) {
    dotnet pack $coreModuleProject -c $Configuration
}

$mediaModuleProject = Join-Path $repoRoot "modules\Astrolune.Media.Module\Astrolune.Media.Module.csproj"
if (Test-Path $mediaModuleProject) {
    dotnet pack $mediaModuleProject -c $Configuration
}
