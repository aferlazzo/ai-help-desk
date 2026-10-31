$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $projectDir "Stop-AI-Help-Desk.ps1")
Start-Sleep -Seconds 1
& (Join-Path $projectDir "Start-AI-Help-Desk.ps1")
