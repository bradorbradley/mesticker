# MeSticker print station runner (Windows).
# Keeps autopilot.mjs running forever: restarts it if it exits or crashes, logs to
# ~\MeSticker Orders\station.log, and keeps the PC awake while it runs (no settings changed).
#   powershell -ExecutionPolicy Bypass -File hardware\station\windows\run-station.ps1 [-IncludeUnverified]
param([switch]$IncludeUnverified, [switch]$Direct)

$ErrorActionPreference = 'Continue'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$orders = Join-Path $HOME 'MeSticker Orders'
New-Item -ItemType Directory -Force $orders | Out-Null
$log = Join-Path $orders 'station.log'

# keep the system (not just the screen) awake while this runs
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
[void][Win32.Power]::SetThreadExecutionState([uint32]2147483649) # ES_CONTINUOUS | ES_SYSTEM_REQUIRED (0x80000001; a hex literal is negative in PowerShell 5)

# find node: PATH first, then the portable install
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node -and (Test-Path "$HOME\tools\node\node.exe")) { $node = "$HOME\tools\node\node.exe" }
if (-not $node) { $node = Get-ChildItem "$env:LOCALAPPDATA\node-portable\*\node.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName }
if (-not $node) { Add-Content $log "$(Get-Date -Format o) RUNNER cannot find node.exe"; exit 1 }

# default: StixCut + print-win.mjs presses Print & Cut. -Direct: USB straight to the printer (StixCut must be closed).
$nodeArgs = @((Join-Path $repo 'hardware\station\autopilot.mjs'))
if ($Direct) { $nodeArgs += '--direct' }
if ($IncludeUnverified) { $nodeArgs += '--include-unverified' }

$fast = 0
while ($true) {
  $t0 = Get-Date
  Add-Content $log "$(Get-Date -Format o) RUNNER starting autopilot ($node)"
  & $node @nodeArgs 2>&1 | ForEach-Object { $_.ToString() } | Out-Null   # autopilot writes station.log itself
  $code = $LASTEXITCODE
  Add-Content $log "$(Get-Date -Format o) RUNNER autopilot exited with code $code, restarting"
  # back off if it keeps dying straight away
  if (((Get-Date) - $t0).TotalSeconds -lt 30) { $fast++ } else { $fast = 0 }
  # node keeps dying on launch (e.g. 0xC0000142 when this long-running session goes bad):
  # quit, and Task Scheduler's 1-minute watchdog starts a fresh runner in a clean session
  if ($fast -ge 5 -or $code -eq 3) { Add-Content $log "$(Get-Date -Format o) RUNNER handing over to a fresh runner"; exit 1 }
  Start-Sleep -Seconds ([Math]::Min(60, 3 * [Math]::Max(1, $fast)))
}
