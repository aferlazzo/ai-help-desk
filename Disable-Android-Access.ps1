$ErrorActionPreference = "Stop"
$ruleName = "AI Help Desk - Private Network"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (!$isAdmin) {
  $powerShellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
  Start-Process -FilePath $powerShellPath -Verb RunAs -ArgumentList ('-NoProfile -NoExit -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"')
  exit
}

Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show("Android access has been disabled in Windows Firewall.", "AI Help Desk", "OK", "Information") | Out-Null
