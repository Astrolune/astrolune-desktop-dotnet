param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputRoot
)

if (-not (Test-Path $ConfigPath)) {
    throw "Config not found: $ConfigPath"
}

$cfgDir = Split-Path -Parent $ConfigPath
$config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
if ($null -eq $config.modules) {
    throw "Config must contain 'modules' array."
}

$bundleRoot = Join-Path $OutputRoot "modules"
New-Item -ItemType Directory -Path $bundleRoot -Force | Out-Null

foreach ($module in $config.modules) {
    if ([string]::IsNullOrWhiteSpace($module.id)) {
        throw "Module entry missing id."
    }

    if ([string]::IsNullOrWhiteSpace($module.packagePath)) {
        throw "Module $($module.id) missing packagePath."
    }

    $packagePath = Join-Path $cfgDir $module.packagePath
    $packagePath = (Resolve-Path $packagePath -ErrorAction Stop).Path

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("Astrolune\\module-bundle\\" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

    $zipPath = $packagePath
    if ([System.IO.Path]::GetExtension($packagePath) -ne ".zip") {
        $zipPath = Join-Path $tempRoot "package.zip"
        Copy-Item -Path $packagePath -Destination $zipPath -Force
    }

    Expand-Archive -Path $zipPath -DestinationPath $tempRoot -Force

    $manifest = Get-ChildItem -Path $tempRoot -Recurse -Filter "module.manifest.json" | Sort-Object FullName | Select-Object -First 1
    $signature = Get-ChildItem -Path $tempRoot -Recurse -Filter "module.sig" | Sort-Object FullName | Select-Object -First 1
    $configFile = Get-ChildItem -Path $tempRoot -Recurse -Filter "module.config.json" | Sort-Object FullName | Select-Object -First 1
    $dll = Get-ChildItem -Path $tempRoot -Recurse -Filter ($module.id + ".dll") | Where-Object { $_.FullName -match "\\lib\\" } | Sort-Object FullName | Select-Object -First 1

    if ($null -eq $manifest -or $null -eq $dll) {
        throw "Package for $($module.id) is missing module.manifest.json or assembly."
    }

    $moduleRoot = Join-Path $bundleRoot $module.id
    New-Item -ItemType Directory -Path $moduleRoot -Force | Out-Null

    $manifestJson = Get-Content -Raw $manifest.FullName | ConvertFrom-Json
    $manifestMin = $manifestJson | ConvertTo-Json -Compress -Depth 32
    Set-Content -Path (Join-Path $moduleRoot "module.manifest.json") -Value $manifestMin -NoNewline -Encoding UTF8
    Copy-Item -Path $dll.FullName -Destination (Join-Path $moduleRoot ($module.id + ".dll")) -Force

    if ($null -ne $signature) {
        Copy-Item -Path $signature.FullName -Destination (Join-Path $moduleRoot "module.sig") -Force
    }

    if ($null -ne $configFile) {
        Copy-Item -Path $configFile.FullName -Destination (Join-Path $moduleRoot "module.config.json") -Force
    }

    $resourceFolder = Get-ChildItem -Path $tempRoot -Recurse -Directory -Filter "resources" | Sort-Object FullName | Select-Object -First 1
    if ($null -ne $resourceFolder) {
        $resourceDest = Join-Path $moduleRoot "resources"
        New-Item -ItemType Directory -Path $resourceDest -Force | Out-Null
        Copy-Item -Path (Join-Path $resourceFolder.FullName "*") -Destination $resourceDest -Recurse -Force
    }

    $resources = Get-ChildItem -Path $tempRoot -Recurse -Filter "*.resources.dll"
    foreach ($resource in $resources) {
        $parts = $resource.FullName.Split([System.IO.Path]::DirectorySeparatorChar)
        $libIndex = [Array]::IndexOf($parts, "lib")
        if ($libIndex -ge 0 -and $libIndex + 2 -lt $parts.Length) {
            $culture = $parts[$libIndex + 2]
            $destDir = Join-Path $moduleRoot $culture
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            Copy-Item -Path $resource.FullName -Destination (Join-Path $destDir $resource.Name) -Force
        }
    }
}
