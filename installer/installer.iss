; Astrolune Desktop Installer Script
; Inno Setup Script with black theme (#000000)

#define MyAppName "Astrolune"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Astrolune"
#define MyAppExeName "astrolune.exe"
#define MyAppUrl "https://astrolune.app"

[Setup]
; Basic settings
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppUrl}
AppSupportURL={#MyAppUrl}
AppUpdatesURL={#MyAppUrl}
AppCopyright=Copyright (C) 2026 Astrolune

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
WizardSizePercent=100,100
DisableWelcomePage=no
LicenseFile=installer\License.txt
InfoBeforeFile=installer\Welcome.txt
InfoAfterFile=installer\Privacy.txt
WizardImageFile=installer\wizard-image.bmp
WizardSmallImageFile=installer\wizard-small.bmp

; Black theme colors
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
Source: "..\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.pdb,modules\\*,modules\\**"
; Note: Don't use "Flags: ignoreversion" on any shared system files
Source: "InstallModules.ps1"; Flags: dontcopy
Source: "modules.build.json"; Flags: dontcopy

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
var
  ModuleOptionsPage: TInputOptionWizardPage;
  ModuleAuthPage: TInputQueryWizardPage;

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

procedure InitializeWizard();
begin
  ModuleOptionsPage := CreateInputOptionPage(
    wpSelectTasks,
    'Module Installation',
    'Download modules from GitHub Packages',
    'Modules are downloaded during setup so the installer stays lightweight.',
    False,
    False
  );
  ModuleOptionsPage.Add('Install modules during setup');
  ModuleOptionsPage.Values[0] := True;

  ModuleAuthPage := CreateInputQueryPage(
    ModuleOptionsPage.ID,
    'GitHub Packages Access',
    'Provide access credentials for private modules',
    'We will use these credentials only during installation to download the required modules.',
    False
  );
  ModuleAuthPage.Add('GitHub username:');
  ModuleAuthPage.Add('GitHub token (PAT):');
  ModuleAuthPage.Values[0] := '';
  ModuleAuthPage.Values[1] := '';
  ModuleAuthPage.Edits[1].PasswordChar := '*';
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (ModuleAuthPage <> nil) and (PageID = ModuleAuthPage.ID) then
    Result := not ModuleOptionsPage.Values[0];
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  ScriptPath: String;
  ConfigPath: String;
  Args: String;
  UserName: String;
  Token: String;
begin
  if CurStep = ssPostInstall then
  begin
    if ModuleOptionsPage.Values[0] then
    begin
      UserName := Trim(ModuleAuthPage.Values[0]);
      Token := Trim(ModuleAuthPage.Values[1]);
      if (UserName = '') or (Token = '') then
      begin
        MsgBox('GitHub credentials are required to download private modules. You can install modules later from the updater.', mbError, MB_OK);
        Exit;
      end;

      ExtractTemporaryFile('InstallModules.ps1');
      ExtractTemporaryFile('modules.build.json');
      ScriptPath := ExpandConstant('{tmp}\\InstallModules.ps1');
      ConfigPath := ExpandConstant('{tmp}\\modules.build.json');

      Args := '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '"' +
        ' -ConfigPath "' + ConfigPath + '"' +
        ' -OutputRoot "' + ExpandConstant('{app}') + '"' +
        ' -GitHubUser "' + UserName + '"' +
        ' -GitHubToken "' + Token + '"';

      if not Exec('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', Args, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      begin
        MsgBox('Failed to launch module installer. Please run the updater after installation.', mbError, MB_OK);
      end
      else if ResultCode <> 0 then
      begin
        MsgBox('Module installation failed with code ' + IntToStr(ResultCode) + '. You can install modules later from the updater.', mbError, MB_OK);
      end;
    end;
  end;
end;

[InstallDelete]
; Clean up old files before installation
Type: filesandordirs; Name: "{app}\modules\Astrolune.Core.Module";
Type: filesandordirs; Name: "{app}\modules\Astrolune.Media.Module";
Type: filesandordirs; Name: "{app}\modules\Astrolune.Auth.Module";

[UninstallDelete]
; Clean up module data on uninstall
Type: filesandordirs; Name: "{userappdata}\Astrolune\modules\Astrolune.Core.Module";
Type: filesandordirs; Name: "{userappdata}\Astrolune\modules\Astrolune.Media.Module";
Type: filesandordirs; Name: "{userappdata}\Astrolune\modules\Astrolune.Auth.Module";
Type: filesandordirs; Name: "{userappdata}\Astrolune\Keyring";
