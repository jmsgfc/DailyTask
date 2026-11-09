#!/usr/bin/env pwsh
<#
.SYNOPSIS
  按角色统计每日任务（DailyTask）进程树的内存占用。

.DESCRIPTION
  从 dailytask.exe 递归解析子进程，按 WebView2 命令行归类为
  browser / gpu-process / network / storage / renderer / crashpad，
  输出私有工作集（与任务管理器同口径）与合计。

  应用未运行时直接报错退出；开发版与安装版共用同一个进程名。

.EXAMPLE
  npm run perf:memory

.EXAMPLE
  npm run perf:memory -- -Samples 10 -IntervalSec 30
#>
[CmdletBinding()]
param(
  [ValidateRange(1, 1000)]
  [int]$Samples = 1,

  [ValidateRange(0, 3600)]
  [int]$IntervalSec = 5
)

$ErrorActionPreference = "Stop"

function Get-ProcessRole {
  param([string]$CommandLine, [string]$Name)

  if ($Name -eq "dailytask.exe") {
    return "app"
  }
  if ($CommandLine -match "--utility-sub-type=([^\s""]+)") {
    $subtype = $matches[1]
    if ($subtype -match "network") { return "network" }
    if ($subtype -match "storage") { return "storage" }
    return $subtype
  }
  if ($CommandLine -match "--type=([a-zA-Z-]+)") {
    return $matches[1]
  }
  if ($Name -eq "dailytask.exe") {
    return "app"
  }
  return "browser"
}

function Get-ProcessTree {
  $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine)
  $roots = @($all | Where-Object { $_.Name -eq "dailytask.exe" })
  if ($roots.Count -eq 0) {
    throw "未找到 dailytask.exe，请先启动 DailyTask"
  }

  $tree = @($roots)
  $pending = @($roots | ForEach-Object { $_.ProcessId })
  while ($pending.Count -gt 0) {
    $parents = $pending
    $pending = @()
    foreach ($process in $all) {
      if (($parents -contains $process.ParentProcessId) -and
          -not ($tree.ProcessId -contains $process.ProcessId)) {
        $tree += $process
        $pending += $process.ProcessId
      }
    }
  }
  return $tree
}

function Get-PrivateWorkingSet {
  $perf = @(Get-CimInstance Win32_PerfFormattedData_PerfProc_Process |
    Where-Object { $_.Name -ne "_Total" })
  $map = @{}
  foreach ($entry in $perf) {
    $map[[int]$entry.IDProcess] = [double]$entry.WorkingSetPrivate
  }
  return $map
}

function Write-Snapshot {
  param([int]$Index, [int]$Total)

  $tree = Get-ProcessTree
  $memory = Get-PrivateWorkingSet

  $rows = foreach ($process in $tree) {
    $bytes = [double]$memory[[int]$process.ProcessId]
    [pscustomobject]@{
      Role   = Get-ProcessRole -CommandLine $process.CommandLine -Name $process.Name
      PID    = $process.ProcessId
      MB     = [math]::Round($bytes / 1MB, 1)
    }
  }

  $totalMb = [math]::Round((($rows | Measure-Object -Property MB -Sum).Sum), 1)
  $label = if ($Total -gt 1) { "采样 $Index/$Total" } else { "采样" }
  Write-Host ""
  Write-Host "$label：$($rows.Count) 个进程，私有工作集合计 $totalMb MB"
  $rows | Sort-Object MB -Descending |
    Format-Table Role, PID, @{ Name = "MB"; Expression = { $_.MB }; Align = "right" } -AutoSize |
    Out-String -Width 80 |
    Write-Host
}

for ($index = 1; $index -le $Samples; $index++) {
  if ($index -gt 1) {
    Start-Sleep -Seconds $IntervalSec
  }
  Write-Snapshot -Index $index -Total $Samples
}
