@echo off
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Enable-Android-Access.ps1"
if errorlevel 1 pause
exit /b 0
