$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $projectDir "AI Help Desk.cmd"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "AI Help Desk.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $projectDir
$shortcut.Description = "Start AI Help Desk"
$shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,68"
$shortcut.Save()

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show("AI Help Desk is now on your desktop.", "AI Help Desk", "OK", "Information") | Out-Null
