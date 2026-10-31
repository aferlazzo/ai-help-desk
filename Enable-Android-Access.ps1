$ErrorActionPreference = "Stop"
$ruleName = "AI Help Desk - Private Network"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (!$isAdmin) {
  $powerShellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
  Start-Process -FilePath $powerShellPath -Verb RunAs -ArgumentList ('-NoProfile -NoExit -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"')
  exit
}

Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4173 -Profile Private -RemoteAddress LocalSubnet | Out-Null

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show("Android access is enabled for devices on your private local network. Restart AI Help Desk, then open run\android-url.txt and send that private link to your Android device.", "AI Help Desk", "OK", "Information") | Out-Null
