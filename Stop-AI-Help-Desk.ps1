$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectDir "run\ai-help-desk.pid"

if (Test-Path -LiteralPath $pidFile) {
  $savedPid = [int](Get-Content -LiteralPath $pidFile -Raw)
  $process = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
  if ($process) {
    $instance = Invoke-RestMethod "http://127.0.0.1:4173/api/instance" -TimeoutSec 3
    if ($process.ProcessName -ne "node" -or $instance.app -ne "AI Help Desk" -or $instance.directory -ne $projectDir -or $instance.pid -ne $savedPid) {
      throw "Cannot safely identify this Help Desk process. Nothing was stopped. Save your work and restart Windows to clear older copies."
    }
    Stop-Process -Id $savedPid -ErrorAction Stop
  }
  Remove-Item -LiteralPath $pidFile -Force
}
