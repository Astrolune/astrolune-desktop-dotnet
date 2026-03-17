param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

if (-not (Test-Path $ConfigPath)) {
    throw "Config not found: $ConfigPath"
}

$config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
if ($null -eq $config.modules) {
    throw "Config must contain 'modules' array."
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("; Auto-generated from modules.build.json")

foreach ($module in $config.modules) {
    if ([string]::IsNullOrWhiteSpace($module.id)) {
        throw "Module entry missing id."
    }

    $moduleId = $module.id
    $lines.Add("Source: `"..\\publish\\modules\\$moduleId\\*`"; DestDir: `"{app}\\modules\\$moduleId`"; Flags: ignoreversion recursesubdirs createallsubdirs")
    $lines.Add("Source: `"..\\publish\\modules\\$moduleId\\module.sig`"; DestDir: `"{app}\\modules\\$moduleId`"; Flags: ignoreversion; Check: FileExists(`"..\\publish\\modules\\$moduleId\\module.sig`")")
}

$lines | Set-Content -Path $OutputPath -Encoding UTF8
