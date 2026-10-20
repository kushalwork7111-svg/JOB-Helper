@echo off
rem Client-Ready (BDO formatting) - registers the PowerPoint add-in for the current Windows user.
rem Writes only to your own user profile: no admin rights, no downloads, no security settings changed.
rem Remove it again with "Uninstall Client-Ready.cmd".
echo.
echo Installing Client-Ready for PowerPoint (current user only)...
set "D=%LOCALAPPDATA%\ClientReady"
set "F=%D%\manifest.xml"
if not exist "%D%" mkdir "%D%"
>"%F%" echo ^<?xml version="1.0" encoding="UTF-8"?^>
>>"%F%" echo ^<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
>>"%F%" echo            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
>>"%F%" echo            xsi:type="TaskPaneApp"^>
>>"%F%" echo   ^<Id^>9f8c4ec6-b750-4940-932b-d3e4a80bf214^</Id^>
>>"%F%" echo   ^<Version^>1.0.0.0^</Version^>
>>"%F%" echo   ^<ProviderName^>BDO India DVCS^</ProviderName^>
>>"%F%" echo   ^<DefaultLocale^>en-US^</DefaultLocale^>
>>"%F%" echo   ^<DisplayName DefaultValue="Client-Ready (BDO formatting)"/^>
>>"%F%" echo   ^<Description DefaultValue="One-click BDO formatting: titles, fonts, body size, colours and a brand check."/^>
>>"%F%" echo   ^<IconUrl DefaultValue="https://kushalwork7111-svg.github.io/JOB-Helper/assets/icon-32.png"/^>
>>"%F%" echo   ^<HighResolutionIconUrl DefaultValue="https://kushalwork7111-svg.github.io/JOB-Helper/assets/icon-64.png"/^>
>>"%F%" echo   ^<SupportUrl DefaultValue="https://kushalwork7111-svg.github.io/JOB-Helper/"/^>
>>"%F%" echo   ^<AppDomains^>^<AppDomain^>https://kushalwork7111-svg.github.io^</AppDomain^>^</AppDomains^>
>>"%F%" echo   ^<Hosts^>^<Host Name="Presentation"/^>^</Hosts^>
>>"%F%" echo   ^<Requirements^>^<Sets DefaultMinVersion="1.1"^>^<Set Name="PowerPointApi" MinVersion="1.4"/^>^</Sets^>^</Requirements^>
>>"%F%" echo   ^<DefaultSettings^>^<SourceLocation DefaultValue="https://kushalwork7111-svg.github.io/JOB-Helper/taskpane.html"/^>^</DefaultSettings^>
>>"%F%" echo   ^<Permissions^>ReadWriteDocument^</Permissions^>
>>"%F%" echo ^</OfficeApp^>
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "9f8c4ec6-b750-4940-932b-d3e4a80bf214" /t REG_SZ /d "%F%" /f >nul
if errorlevel 1 (
  echo.
  echo Could not register the add-in. Your organisation may block this; nothing else was changed.
  pause
  exit /b 1
)
echo.
echo Done. Now:
echo   1. Close PowerPoint completely (all windows) and open it again.
echo   2. Home ^> Add-ins: Client-Ready is listed under Developer add-ins.
echo   3. If it is not there yet, restart the laptop once.
echo.
pause
