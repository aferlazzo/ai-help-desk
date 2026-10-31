$ErrorActionPreference = "Stop"
$ruleName = "AI Help Desk - Private Network"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (!$isAdmin) { throw "Administrator permission is required to update Windows Firewall." }

Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show("Android access has been disabled in Windows Firewall.", "AI Help Desk", "OK", "Information") | Out-Null
