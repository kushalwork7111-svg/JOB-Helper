@echo off
rem Client-Ready (BDO formatting) - removes the add-in registration for the current Windows user.
echo Removing Client-Ready...
reg delete "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "9f8c4ec6-b750-4940-932b-d3e4a80bf214" /f >nul 2>&1
if exist "%LOCALAPPDATA%\ClientReady" rmdir /s /q "%LOCALAPPDATA%\ClientReady"
echo Done. Close and reopen PowerPoint.
pause
