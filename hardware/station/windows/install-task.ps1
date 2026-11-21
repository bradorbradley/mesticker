# Register the station to start at log-on and restart if it stops (current user, no admin).
#   powershell -ExecutionPolicy Bypass -File hardware\station\windows\install-task.ps1 [-IncludeUnverified]
#   Start now:  Start-ScheduledTask -TaskName 'MeSticker Station'
#   Stop:       Stop-ScheduledTask  -TaskName 'MeSticker Station'
#   Remove:     Unregister-ScheduledTask -TaskName 'MeSticker Station' -Confirm:$false
param([switch]$IncludeUnverified)

$runner = Join-Path $PSScriptRoot 'run-station.ps1'
# conhost --headless runs the console with no window at all (-WindowStyle Hidden still flashes one
# and leaves it up when anything is printed)
$arg = "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$runner`""
if ($IncludeUnverified) { $arg += ' -IncludeUnverified' }
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument $arg
# at log-on, plus every minute as a watchdog: if the station is ever gone it's back within a minute
# (MultipleInstances IgnoreNew means a running station is never doubled)
$logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$watchdog = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$trigger = @($logon, $watchdog)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'MeSticker Station' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
"Registered 'MeSticker Station' (starts at log-on). Log: $HOME\MeSticker Orders\station.log"
