# Press Print & Cut in StixCut for Windows on one sheet, hands-off (UI Automation).
#   powershell -NoProfile -ExecutionPolicy Bypass -File stixcut-print.ps1 -Sheet "C:\...\sheet-1.stixcut"
#   powershell ... -File stixcut-print.ps1 -Status        (what StixCut shows right now)
# Prints one JSON line: { ok, stage, error?, openMs, startedMs }.
#
# StixCut 1.0.23 crashes if a file is handed to an instance that is already open, so each
# sheet gets a fresh StixCut: wait until the previous job is Done, close it, open the sheet.
param([string]$Sheet, [switch]$Status, [int]$IdleTimeout = 360, [int]$OpenTimeout = 45)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$A = [Windows.Automation.AutomationElement]
$Scope = [Windows.Automation.TreeScope]
$sw = [Diagnostics.Stopwatch]::StartNew()

function Out-Result($h) { $h.ms = $sw.ElapsedMilliseconds; ($h | ConvertTo-Json -Compress); exit ($(if ($h.ok) { 0 } else { 1 })) }

function Get-Win {
  $p = Get-Process StixCut -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $p) { return $null }
  $A::RootElement.FindFirst($Scope::Children, (New-Object Windows.Automation.PropertyCondition($A::ProcessIdProperty, $p.Id)))
}

function Get-Texts($w) {
  @($w.FindAll($Scope::Descendants, (New-Object Windows.Automation.PropertyCondition($A::ControlTypeProperty, [Windows.Automation.ControlType]::Text))) | ForEach-Object { $_.Current.Name })
}

# job state from the PRINT QUEUE panel: "upload - …", "print - …", "cut - …", "Done - …"
function Get-State($w) {
  $t = Get-Texts $w
  $i = [array]::IndexOf($t, 'PRINT QUEUE')
  $job = $null
  if ($i -ge 0) { $job = $t[($i + 1)..([Math]::Min($t.Count - 1, $i + 4))] | Where-Object { $_ -match '^(upload|print|cut|done|error|failed|cancel)\w* - ' } | Select-Object -First 1 }
  $printer = ($t | Where-Object { $_ -match '^\d+ (READY|BUSY|PRINTING)|NOT CONNECTED|OFFLINE|PRINTING|ERROR|paper|ribbon|jam' } | Select-Object -Unique) -join ', '
  $msg = ($t | Where-Object { $_ -match 'error|fail|paper|ribbon|jam|cover|disconnect' } | Select-Object -First 1)
  [pscustomobject]@{ job = $job; busy = [bool]($job -match '^(upload|print|cut) - '); ready = [bool]($t -match '^\d+ READY$'); printer = $printer; message = $msg }
}

function Get-PrintButton($w) {
  $t = $w.FindFirst($Scope::Descendants, (New-Object Windows.Automation.PropertyCondition($A::NameProperty, 'Print & Cut')))
  if (-not $t) { return $null }
  [Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($t)
}

if ($Status) {
  $w = Get-Win
  if (-not $w) { Out-Result @{ ok = $false; stage = 'status'; error = 'StixCut is not running' } }
  $s = Get-State $w
  Out-Result @{ ok = $true; stage = 'status'; job = $s.job; busy = $s.busy; ready = $s.ready; printer = $s.printer; message = $s.message }
}

if (-not $Sheet -or -not (Test-Path $Sheet)) { Out-Result @{ ok = $false; stage = 'args'; error = "sheet file not found: $Sheet" } }

# 1. let the previous job finish, then close that StixCut
$w = Get-Win
if ($w) {
  $deadline = (Get-Date).AddSeconds($IdleTimeout)
  while ((Get-State $w).busy) {
    if ((Get-Date) -gt $deadline) { Out-Result @{ ok = $false; stage = 'wait-idle'; error = "previous job still running after $IdleTimeout s: $((Get-State $w).job)" } }
    Start-Sleep -Milliseconds 1000
    $w = Get-Win; if (-not $w) { break }
  }
  foreach ($p in Get-Process StixCut -ErrorAction SilentlyContinue) { [void]$p.CloseMainWindow() }
  for ($i = 0; $i -lt 40 -and (Get-Process StixCut -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 100 }
  # idle (checked above), so nothing is lost by forcing it
  Get-Process StixCut -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 300
}

# 2. open the sheet in a fresh StixCut and wait for Print & Cut to be ready
$tOpen = $sw.ElapsedMilliseconds
Start-Process -FilePath $Sheet
$name = [IO.Path]::GetFileNameWithoutExtension($Sheet)
$deadline = (Get-Date).AddSeconds($OpenTimeout)
$btn = $null
while (-not $btn) {
  if ((Get-Date) -gt $deadline) {
    $w = Get-Win
    $why = if (-not $w) { 'StixCut did not start' } elseif (-not (Get-State $w).ready) { "printer not ready in StixCut ($((Get-State $w).printer))" } else { 'Print & Cut never became clickable' }
    Out-Result @{ ok = $false; stage = 'open'; error = $why }
  }
  Start-Sleep -Milliseconds 250
  $w = Get-Win
  if (-not $w) { continue }
  $b = Get-PrintButton $w
  if ($b -and $b.Current.IsEnabled -and (Get-State $w).ready -and ((Get-Texts $w) -contains $name)) { $btn = $b }
}
$openMs = $sw.ElapsedMilliseconds - $tOpen

# 3. press it and confirm the job started
$btn.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern).Invoke()
$deadline = (Get-Date).AddSeconds(20)
while ($true) {
  Start-Sleep -Milliseconds 250
  $s = Get-State (Get-Win)
  if ($s.busy) { Out-Result @{ ok = $true; stage = 'started'; job = $s.job; openMs = $openMs; startedMs = $sw.ElapsedMilliseconds } }
  if ((Get-Date) -gt $deadline) { Out-Result @{ ok = $false; stage = 'press'; error = "pressed Print & Cut but no job started ($($s.printer) $($s.message))" } }
}
