# Press Print & Cut in StixCut for Windows on one sheet, hands-off (UI Automation + window messages).
#   powershell -NoProfile -ExecutionPolicy Bypass -File stixcut-print.ps1 -Sheet "C:\...\sheet-1.stixcut"
#   powershell ... -File stixcut-print.ps1 -Status        (what StixCut shows right now)
# Prints one JSON line: { ok, stage, error?, openMs, startedMs }.
#
# StixCut stays open and connected between orders: each sheet is loaded through StixCut's own
# Open button (the file dialog is filled with WM_SETTEXT / BM_CLICK, so nothing needs focus and
# no keystrokes are sent anywhere). StixCut 1.0.23 crashes when a file is handed to a running
# instance from outside, so it is only launched with a file when it isn't running at all.
param([string]$Sheet, [switch]$Status, [switch]$NoPress, [int]$IdleTimeout = 360, [int]$OpenTimeout = 45, [int]$StartTimeout = 90)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -Namespace W -Name U -MemberDefinition @'
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, string l);
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
'@
$A = [Windows.Automation.AutomationElement]
$Scope = [Windows.Automation.TreeScope]
$Walker = [Windows.Automation.TreeWalker]::ControlViewWalker
$sw = [Diagnostics.Stopwatch]::StartNew()

function Out-Result($h) { $h.ms = $sw.ElapsedMilliseconds; ($h | ConvertTo-Json -Compress); exit ($(if ($h.ok) { 0 } else { 1 })) }
function Cond($prop, $val) { New-Object Windows.Automation.PropertyCondition($prop, $val) }

function Get-Win {
  $p = Get-Process StixCut -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $p) { return $null }
  $A::RootElement.FindFirst($Scope::Children, (Cond $A::ProcessIdProperty $p.Id))
}
function Get-Texts($w) { @($w.FindAll($Scope::Descendants, (Cond $A::ControlTypeProperty ([Windows.Automation.ControlType]::Text))) | ForEach-Object { $_.Current.Name }) }
function Invoke-El($el) {
  while ($el -and -not ($el.GetSupportedPatterns() -contains [Windows.Automation.InvokePattern]::Pattern)) { $el = $Walker.GetParent($el) }
  if (-not $el -or -not $el.Current.IsEnabled) { return $false }
  try { $el.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern).Invoke(); return $true } catch { return $false }
}

# PRINT QUEUE rows are "<doc>" then "<state> - PixCut …" (newest first). Only short labels count:
# StixCut's help texts mention "jams" etc. and must not trip the status.
function Get-State($w, [string]$doc) {
  $t = Get-Texts $w
  $i = [array]::IndexOf($t, 'PRINT QUEUE')
  $jobs = @()
  if ($i -ge 0) {
    for ($k = $i + 1; $k -lt $t.Count - 1; $k++) {
      if ($t[$k + 1] -match '^(\w+) - ') { $jobs += [pscustomobject]@{ doc = $t[$k]; state = $Matches[1]; text = $t[$k + 1] }; $k++ }
      elseif ($t[$k] -match '^(Sheet Controls|Sticker Controls|AUTO-PACK SHEET|MEDIA)') { break }
    }
  }
  $short = $t | Where-Object { $_ -and $_.Length -le 60 }
  $printer = ($short | Where-Object { $_ -match '^\d+ (READY|BUSY|PRINTING)|NOT CONNECTED|DISCONNECTED|OFFLINE|^PRINTING|ERROR' } | Select-Object -Unique) -join ', '
  $msg = ($short | Where-Object { $_ -match 'error|failed|out of paper|no paper|ribbon|jammed|paper jam|cover open|disconnect' } | Select-Object -First 1)
  $busy = [bool]($jobs | Where-Object { $_.state -match '^(upload|print|cut|queued|pending|sending)' })
  $mine = if ($doc) { $jobs | Where-Object { $_.doc -eq $doc } | Select-Object -First 1 } else { $null }
  [pscustomobject]@{ job = ($jobs | Select-Object -First 1).text; busy = $busy; ready = [bool]($t -match '^\d+ READY$'); printer = $printer; message = $msg; mine = $mine; docName = (($w.FindFirst($Scope::Descendants, (Cond $A::AutomationIdProperty 'DocNameText'))).Current.Name) }
}

function Get-PrintButton($w) {
  $t = $w.FindFirst($Scope::Descendants, (Cond $A::NameProperty 'Print & Cut'))
  if ($t) { $Walker.GetParent($t) } else { $null }
}

# close "Your sheet is ready … PRINT ANOTHER / DONE" and any leftover modal
function Close-DonePanel($w) {
  $b = $w.FindAll($Scope::Descendants, (Cond $A::NameProperty 'DONE')) | Where-Object { $_.Current.ControlType -eq [Windows.Automation.ControlType]::Button } | Select-Object -First 1
  if ($b) { [void](Invoke-El $b); Start-Sleep -Milliseconds 300 }
}

# printer shows "not connected": press StixCut's Connect / Add control and wait for READY
function Connect-Printer($w) {
  $c = $w.FindAll($Scope::Descendants, [Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.Name -match '^(Connect|Reconnect|Connect Printer|Add Printer|Add)$' } | Select-Object -First 1
  if ($c) { [void](Invoke-El $c) }
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $w = Get-Win
    if ($w -and (Get-State $w).ready) { return $true }
    # a picker may have opened: choose the PixCut entry
    $pick = $w.FindAll($Scope::Descendants, [Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.Name -match 'PixCut S1' -and $_.Current.ControlType -ne [Windows.Automation.ControlType]::Text } | Select-Object -First 1
    if ($pick) { [void](Invoke-El $pick) }
  }
  $false
}

# fill StixCut's Open dialog (#32770, hosted by the Windows picker) without focus or keystrokes
function Open-InStixCut($w, [string]$path) {
  $btn = $w.FindFirst($Scope::Descendants, (Cond $A::AutomationIdProperty 'OpenToolButton'))
  if (-not $btn) { throw 'StixCut Open button not found' }
  [void](Invoke-El $btn)
  $dlg = $null
  for ($i = 0; $i -lt 60 -and -not $dlg; $i++) { Start-Sleep -Milliseconds 100; $dlg = $A::RootElement.FindFirst($Scope::Descendants, (Cond $A::ClassNameProperty '#32770')) }
  if (-not $dlg) { throw 'Open dialog did not appear' }
  $edit = $dlg.FindAll($Scope::Descendants, (Cond $A::ClassNameProperty 'Edit')) | Where-Object { $_.Current.AutomationId -eq '1148' } | Select-Object -First 1
  $ok = $dlg.FindAll($Scope::Descendants, (Cond $A::ClassNameProperty 'Button')) | Where-Object { $_.Current.AutomationId -eq '1' } | Select-Object -First 1
  if (-not $edit -or -not $ok) { throw 'Open dialog controls not found' }
  [void][W.U]::SendMessage([IntPtr]$edit.Current.NativeWindowHandle, 0x000C, [IntPtr]::Zero, $path)   # WM_SETTEXT
  [void][W.U]::PostMessage([IntPtr]$ok.Current.NativeWindowHandle, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero) # BM_CLICK
  for ($i = 0; $i -lt 50; $i++) {
    Start-Sleep -Milliseconds 100
    $d = $A::RootElement.FindFirst($Scope::Descendants, (Cond $A::ClassNameProperty '#32770'))
    if (-not $d) { return }
    # "save changes?" style prompt: never save, keep going
    $no = $d.FindAll($Scope::Descendants, [Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.Name -match "^(Don't save|Don.t Save|No|Discard)$" } | Select-Object -First 1
    if ($no) { [void](Invoke-El $no) }
  }
}

if ($Status) {
  $w = Get-Win
  if (-not $w) { Out-Result @{ ok = $false; stage = 'status'; error = 'StixCut is not running' } }
  $s = Get-State $w
  Out-Result @{ ok = $true; stage = 'status'; job = $s.job; busy = $s.busy; ready = $s.ready; printer = $s.printer; message = $s.message }
}

if (-not $Sheet -or -not (Test-Path $Sheet)) { Out-Result @{ ok = $false; stage = 'args'; error = "sheet file not found: $Sheet" } }

# a unique document name per order and sheet, so we know the right file is loaded and find its job
$dir = Split-Path $Sheet
$doc = ('{0}-{1}' -f (Split-Path $dir -Leaf).Substring(0, [Math]::Min(8, (Split-Path $dir -Leaf).Length)), [IO.Path]::GetFileNameWithoutExtension($Sheet))
$target = Join-Path $dir "$doc.stixcut"
Copy-Item -LiteralPath $Sheet -Destination $target -Force

$tOpen = $sw.ElapsedMilliseconds
$w = Get-Win
if (-not $w) {
  # not running: a cold start with the file is safe
  Start-Process -FilePath $target
} else {
  # 1. let the previous job finish (the printer holds one job), tidy up
  $deadline = (Get-Date).AddSeconds($IdleTimeout)
  while ((Get-State $w).busy) {
    if ((Get-Date) -gt $deadline) { Out-Result @{ ok = $false; stage = 'wait-idle'; error = "previous job still running after $IdleTimeout s: $((Get-State $w).job)" } }
    Start-Sleep -Milliseconds 1000
    $w = Get-Win; if (-not $w) { Out-Result @{ ok = $false; stage = 'wait-idle'; error = 'StixCut closed while waiting' } }
  }
  Close-DonePanel $w
  # 2. load the sheet in place
  try { Open-InStixCut $w $target } catch { Out-Result @{ ok = $false; stage = 'open'; error = "$_" } }
}

# 3. wait until our sheet is loaded and the printer is connected
$deadline = (Get-Date).AddSeconds($OpenTimeout)
$btn = $null; $triedConnect = $false
while (-not $btn) {
  Start-Sleep -Milliseconds 200
  $w = Get-Win
  if (-not $w) { if ((Get-Date) -gt $deadline) { Out-Result @{ ok = $false; stage = 'open'; error = 'StixCut did not start' } }; continue }
  $s = Get-State $w
  if (-not $s.ready -and -not $triedConnect -and $s.docName -eq $doc) { $triedConnect = $true; [void](Connect-Printer $w); continue }
  $b = Get-PrintButton $w
  if ($b -and $b.Current.IsEnabled -and $s.ready -and $s.docName -eq $doc) { $btn = $b; break }
  if ((Get-Date) -gt $deadline) {
    $why = if ($s.docName -ne $doc) { "sheet didn't load (StixCut shows '$($s.docName)')" } elseif (-not $s.ready) { "printer not connected in StixCut ($($s.printer))" } else { 'Print & Cut never became clickable' }
    Out-Result @{ ok = $false; stage = 'open'; error = $why }
  }
}
$openMs = $sw.ElapsedMilliseconds - $tOpen
if ($NoPress) { Out-Result @{ ok = $true; stage = 'loaded'; doc = $doc; openMs = $openMs } }

# 4. press it and confirm the printer took the job (StixCut prepares the sheet first: allow time)
[void](Invoke-El $btn)
$deadline = (Get-Date).AddSeconds($StartTimeout)
while ($true) {
  Start-Sleep -Milliseconds 300
  $w = Get-Win
  $s = Get-State $w $doc
  if ($s.mine -and $s.mine.state -match '^(upload|print|cut|done)') { Out-Result @{ ok = $true; stage = 'started'; job = $s.mine.text; openMs = $openMs; startedMs = $sw.ElapsedMilliseconds } }
  if ($s.mine -and $s.mine.state -match '^(cancel|fail|error)') { Out-Result @{ ok = $false; stage = 'press'; error = "job $($s.mine.text)" } }
  if ((Get-Date) -gt $deadline) { Out-Result @{ ok = $false; stage = 'press'; error = "pressed Print & Cut but no job started in $StartTimeout s ($($s.printer) $($s.message))" } }
}
