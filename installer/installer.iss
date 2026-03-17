; Astrolune Desktop Installer Script
; Inno Setup Script with black theme (#000000)

#define MyAppName "Astrolune"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Astrolune"
#define MyAppExeName "astrolune.exe"
#define MyAppUrl "https://astrolune.app"

[Setup]
; Basic settings
AppId={A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppURL={#MyAppUrl}
AppSupportURL={#MyAppUrl}
AppUpdatesURL={#MyAppUrl}

; Installation paths
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
UsePreviousAppDir=yes

; Output
OutputDir=.
OutputBaseFilename=Astrolune-Setup-{#MyAppVersion}
SetupIconFile=compiler:SetupClassicIcon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

; Compression
Compression=lzma2/max
SolidCompression=yes
LZMAUseSeparateProcess=yes

; Wizard style - Modern with black theme
WizardStyle=modern
WizardResizable=no
WizardSizePercent=100,80

; Black theme colors
WizardColor=000000
WizardImageBackColor=000000
WizardImageStretch=yes

; Privileges
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Architecture
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

; Minimum Windows version
MinVersion=10.0.19041

; Close application during update
CloseApplications=yes
RestartApplications=no
AllowNoIcons=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.4; Check: not IsAdminInstallMode

[Files]
; Main application files
Source: "..\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Note: Don't use "Flags: ignoreversion" on any shared system files
; Exclude app/ directory from wildcard (will be included separately)
Excludes: "*.pdb"
#include "installer.modules.iss"

[Icons]
; Start Menu
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

; Desktop icon
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

; Quick Launch icon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; Launch application after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
// Custom code for additional functionality

function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  // Check if already installed
  if RegKeyExists(HKLM, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#SetupSetting("AppId")}_is1') then
  begin
    if MsgBox('Astrolune is already installed. Do you want to continue?', mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;

  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Additional post-installation tasks can be added here
  end;
end;

// Check if file exists
function FileExists(const Path: String): Boolean;
begin
  Result := FileExists(Path);
end;

[InstallDelete]
; Clean up old files before installation
Type: filesandordirs; Name: "{app}\modules\Astrolune.Core.Module";
Type: filesandordirs; Name: "{app}\modules\Astrolune.Media.Module";

[UninstallDelete]
; Clean up module data on uninstall
Type: filesandordirs; Name: "{userappdata}\Astrolune\modules\Astrolune.Core.Module";
Type: filesandordirs; Name: "{userappdata}\Astrolune\modules\Astrolune.Media.Module";
Type: filesandordirs; Name: "{userappdata}\Astrolune\Keyring";
