param(
  [string]$Target = "C:\Users\28068\Documents\Obsidian Vault\.obsidian\plugins\sakura-blog-publisher"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Source = Join-Path $ProjectRoot "obsidian\.obsidian\plugins\sakura-blog-publisher"

function Get-Sha256 {
  param([string]$Path)

  $Stream = [System.IO.File]::OpenRead($Path)
  try {
    $Sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $Hash = $Sha.ComputeHash($Stream)
      return ([System.BitConverter]::ToString($Hash)).Replace("-", "")
    } finally {
      $Sha.Dispose()
    }
  } finally {
    $Stream.Dispose()
  }
}

if (-not (Test-Path $Source)) {
  throw "Plugin source not found: $Source"
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null
Copy-Item -Path (Join-Path $Source "*") -Destination $Target -Recurse -Force

$Files = @("main.js", "manifest.json", "metadata.js", "styles.css")
foreach ($File in $Files) {
  $SourceFile = Join-Path $Source $File
  $TargetFile = Join-Path $Target $File
  if (-not (Test-Path $TargetFile)) {
    throw "Plugin file missing after sync: $TargetFile"
  }

  $SourceHash = Get-Sha256 $SourceFile
  $TargetHash = Get-Sha256 $TargetFile
  if ($SourceHash -ne $TargetHash) {
    throw "Plugin file hash mismatch after sync: $File"
  }
}

Write-Host "Synced Sakura Blog Publisher to $Target"
