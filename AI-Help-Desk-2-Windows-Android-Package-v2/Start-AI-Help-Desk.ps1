param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appFile = Join-Path $projectDir "ai-help-desk-2-working-with-system-health.js"
$runDir = Join-Path $projectDir "run"
$logFile = Join-Path $runDir "ai-help-desk.log"
$errorLog = Join-Path $runDir "ai-help-desk-error.log"
$pidFile = Join-Path $runDir "ai-help-desk.pid"
$appUrl = "http://127.0.0.1:4173"
$ollamaUrl = "http://127.0.0.1:11434"
$requiredModels = @("qwen3:8b", "qwen3-vl:2b-instruct")

Add-Type -AssemblyName PresentationFramework

function Show-HelpDeskMessage([string]$message, [string]$title = "AI Help Desk") {
  [System.Windows.MessageBox]::Show($message, $title, "OK", "Information") | Out-Null
}

function Test-Url([string]$url, [int]$timeoutSeconds = 3) {
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec $timeoutSeconds | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Find-Program([string]$commandName, [string[]]$fallbackPaths) {
  $command = Get-Command $commandName -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  foreach ($candidate in $fallbackPaths) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  return $null
}

try {
  if (Test-Url "$appUrl/api/health") {
    if (!$NoBrowser) { Start-Process $appUrl }
    exit 0
  }

  if (!(Test-Path -LiteralPath $appFile)) {
    throw "The main AI Help Desk file is missing from this folder."
  }

  $node = Find-Program "node.exe" @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
  )
  if (!$node) {
    throw "Node.js is not installed. Install Node.js, then start AI Help Desk again."
  }

  $ollama = Find-Program "ollama.exe" @(
    (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe")
  )
  if (!$ollama) {
    throw "Ollama is not installed. Install Ollama, then start AI Help Desk again."
  }

  if (!(Test-Url "$ollamaUrl/api/tags")) {
    Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      Start-Sleep -Milliseconds 750
      if (Test-Url "$ollamaUrl/api/tags") { $ready = $true; break }
    }
    if (!$ready) { throw "Ollama did not start. Open Ollama once, then try again." }
  }

  $installed = (Invoke-RestMethod -Uri "$ollamaUrl/api/tags" -TimeoutSec 10).models.name
  $missing = @($requiredModels | Where-Object { $_ -notin $installed })
  if ($missing.Count) {
    $names = $missing -join " and "
    $choice = [System.Windows.MessageBox]::Show(
      "AI Help Desk needs the local model(s) $names. Download them now? This is a one-time download and may take several minutes.",
      "AI Help Desk setup",
      "YesNo",
      "Question"
    )
    if ($choice -ne "Yes") { exit 0 }
    foreach ($model in $missing) {
      Show-HelpDeskMessage "Downloading $model locally. Click OK, then please wait for setup to finish." "AI Help Desk setup"
      $body = @{ model = $model; stream = $false } | ConvertTo-Json -Compress
      Invoke-RestMethod -Method Post -Uri "$ollamaUrl/api/pull" -ContentType "application/json" -Body $body -TimeoutSec 3600 | Out-Null
    }
  }

  New-Item -ItemType Directory -Path $runDir -Force | Out-Null
  $env:AI_HELP_DESK_NO_AUTO_OPEN = "1"
  $process = Start-Process -FilePath $node -ArgumentList ('"' + $appFile + '"') -WorkingDirectory $projectDir -WindowStyle Hidden -RedirectStandardOutput $logFile -RedirectStandardError $errorLog -PassThru
  Remove-Item Env:AI_HELP_DESK_NO_AUTO_OPEN -ErrorAction SilentlyContinue
  Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii

  $started = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Test-Url "$appUrl/api/health") { $started = $true; break }
    if ($process.HasExited) { break }
  }
  if (!$started) {
    $detail = if (Test-Path $errorLog) { (Get-Content -LiteralPath $errorLog -Raw).Trim() } else { "" }
    throw ("AI Help Desk did not start." + $(if ($detail) { "`n`n$detail" } else { "" }))
  }

  if (!$NoBrowser) { Start-Process $appUrl }
} catch {
  Show-HelpDeskMessage $_.Exception.Message "AI Help Desk could not start"
  exit 1
}
