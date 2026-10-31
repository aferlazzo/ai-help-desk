$ErrorActionPreference = "Stop"
$ruleName = "AI Help Desk - Private Network"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (!$isAdmin) { throw "Administrator permission is required to update Windows Firewall." }

Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4173 -Profile Private -RemoteAddress LocalSubnet | Out-Null

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show("Android access is enabled for devices on your private local network. Restart AI Help Desk, then open run\android-url.txt and send that private link to your Android device.", "AI Help Desk", "OK", "Information") | Out-Null
