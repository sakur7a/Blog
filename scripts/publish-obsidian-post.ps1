param(
  [Parameter(Mandatory = $true, Position = 0)]
[string]$DraftPath,

[string]$CoverPath,

[string]$CoverPosition = "50% 50%",

[switch]$NoCommit,
[switch]$NoPush,
[switch]$SkipTests
)

$ErrorActionPreference = "Stop"

function Convert-ToSlug {
  param([string]$Value)
  $slug = $Value.ToLowerInvariant()
  $slug = $slug -replace "[^\p{Ll}\p{Lu}\p{Nd}]+", "-"
  $slug = $slug.Trim("-")
  if ([string]::IsNullOrWhiteSpace($slug)) {
    $hashBytes = [System.Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))
    $hash = -join ($hashBytes[0..2] | ForEach-Object { $_.ToString("x2") })
    $slug = "post-$hash"
  }
  return $slug
}

function Get-FrontMatter {
  param([string]$Content)
  if ($Content -match "(?s)^---\r?\n(.*?)\r?\n---\r?\n?(.*)$") {
    return @{
      Raw = $Matches[1]
      Body = $Matches[2]
      HasFrontMatter = $true
    }
  }

  return @{
    Raw = ""
    Body = $Content
    HasFrontMatter = $false
  }
}

function Get-YamlValue {
  param(
    [string]$Yaml,
    [string]$Key
  )
  $pattern = "(?m)^$([regex]::Escape($Key)):\s*(.+?)\s*$"
  if ($Yaml -match $pattern) {
    return $Matches[1].Trim().Trim('"').Trim("'")
  }
  return $null
}

function Set-YamlValue {
  param(
    [string]$Yaml,
    [string]$Key,
    [string]$Value
  )
  $line = "${Key}: $Value"
  if ($Yaml -match "(?m)^$([regex]::Escape($Key)):\s*.+?$") {
    return [regex]::Replace($Yaml, "(?m)^$([regex]::Escape($Key)):\s*.+?$", $line)
  }
  if ([string]::IsNullOrWhiteSpace($Yaml)) {
    return $line
  }
  return $Yaml.TrimEnd() + "`n" + $line
}

function Resolve-AttachmentPath {
  param(
    [string]$Reference,
    [string]$DraftDirectory,
    [string]$Root
  )

  $candidates = @()
  $candidates += Join-Path $DraftDirectory $Reference
  $candidates += Join-Path $Root "obsidian/Attachments/$Reference"
  $candidates += Join-Path $Root $Reference

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  $fileName = Split-Path $Reference -Leaf
  $found = Get-ChildItem -Path (Join-Path $Root "obsidian") -Recurse -File -Filter $fileName -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) {
    return $found.FullName
  }

  return $null
}

function Write-PreviewManifest {
  param(
    [string]$Root,
    [string[]]$Paths
  )

  $manifestPath = Join-Path $Root ".obsidian-preview.json"
  $manifest = @{
    createdAt = (Get-Date).ToString("o")
    paths = $Paths
  }
  $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
}

function Normalize-DisplayMath {
  param([string]$Markdown)

  $normalized = $Markdown -replace "`r`n", "`n"
  $normalized = [regex]::Replace($normalized, '(?s)(?<!\$)\$\$(.+?)\$\$(?!\$)', {
    param($match)
    $math = $match.Groups[1].Value.Trim()
    $delimiter = [string]([char]36) + [string]([char]36)
    return "`n`n$delimiter`n$math`n$delimiter`n`n"
  })
  return ($normalized -replace "`n{3,}", "`n`n").TrimStart()
}

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$draftFullPath = (Resolve-Path -LiteralPath $DraftPath).Path
$draftDirectory = Split-Path $draftFullPath -Parent
$content = Get-Content -Raw -Encoding UTF8 -LiteralPath $draftFullPath
$front = Get-FrontMatter -Content $content
$yaml = $front.Raw
$body = $front.Body.TrimStart()

$title = Get-YamlValue -Yaml $yaml -Key "title"
if ([string]::IsNullOrWhiteSpace($title)) {
  $title = [IO.Path]::GetFileNameWithoutExtension($draftFullPath)
}

$now = Get-Date
$dateValue = Get-YamlValue -Yaml $yaml -Key "date"
if ([string]::IsNullOrWhiteSpace($dateValue)) {
  $dateValue = $now.ToString("yyyy-MM-dd HH:mm:ss +0800")
}

$datePrefix = if ($dateValue -match "^(\d{4}-\d{2}-\d{2})") { $Matches[1] } else { $now.ToString("yyyy-MM-dd") }
$slug = Get-YamlValue -Yaml $yaml -Key "slug"
if ([string]::IsNullOrWhiteSpace($slug)) {
  $slug = Convert-ToSlug -Value $title
}

$summary = Get-YamlValue -Yaml $yaml -Key "summary"
if ([string]::IsNullOrWhiteSpace($summary)) {
  $plain = ($body -replace '(?s)!\[\[.*?\]\]', '' -replace '(?s)!\[.*?\]\(.*?\)', '' -replace '[#>*_\[\]-]', '').Trim()
  $firstLine = ($plain -split "\r?\n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
  if ([string]::IsNullOrWhiteSpace($firstLine)) {
    $firstLine = "New post"
  }
  $summary = if ($firstLine.Length -gt 80) { $firstLine.Substring(0, 80) } else { $firstLine }
}

$yaml = Set-YamlValue -Yaml $yaml -Key "title" -Value ('"{0}"' -f $title)
$yaml = Set-YamlValue -Yaml $yaml -Key "date" -Value $dateValue
$categories = Get-YamlValue -Yaml $yaml -Key "categories"
if ([string]::IsNullOrWhiteSpace($categories)) {
  $categories = "[" + [char]0x968F + [char]0x7B14 + "]"
}
$yaml = Set-YamlValue -Yaml $yaml -Key "categories" -Value $categories
$yaml = Set-YamlValue -Yaml $yaml -Key "summary" -Value ('"{0}"' -f $summary)

$assetDirRelative = "assets/images/posts/$datePrefix-$slug"
$assetDir = Join-Path $root $assetDirRelative
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

if (-not [string]::IsNullOrWhiteSpace($CoverPath)) {
  $resolvedCoverPath = (Resolve-Path -LiteralPath $CoverPath).Path
  $coverExtension = [IO.Path]::GetExtension($resolvedCoverPath).ToLowerInvariant()
  $allowedCoverExtensions = @(".png", ".jpg", ".jpeg", ".webp", ".gif")
  if ($allowedCoverExtensions -notcontains $coverExtension) {
    throw "Unsupported cover image type: $coverExtension"
  }

  $coverFileName = "cover$coverExtension"
  Copy-Item -LiteralPath $resolvedCoverPath -Destination (Join-Path $assetDir $coverFileName) -Force
  $yaml = Set-YamlValue -Yaml $yaml -Key "cover" -Value ('"/{0}/{1}"' -f $assetDirRelative, $coverFileName)
  $yaml = Set-YamlValue -Yaml $yaml -Key "cover_position" -Value ('"{0}"' -f $CoverPosition)
}

$body = [regex]::Replace($body, '!\[\[([^\]]+)\]\]', {
  param($match)
  $reference = ($match.Groups[1].Value -split '\|')[0]
  $source = Resolve-AttachmentPath -Reference $reference -DraftDirectory $draftDirectory -Root $root
  if (-not $source) {
    Write-Warning "Image not found: $reference"
    return $match.Value
  }
  $name = Split-Path $source -Leaf
  Copy-Item -LiteralPath $source -Destination (Join-Path $assetDir $name) -Force
  return "![]({{ '/$assetDirRelative/$name' | relative_url }})"
})

$body = [regex]::Replace($body, '!\[([^\]]*)\]\(([^)]+)\)', {
  param($match)
  $alt = $match.Groups[1].Value
  $reference = $match.Groups[2].Value
  if ($reference -match '^(https?:)?//|^\{\{') {
    return $match.Value
  }
  $source = Resolve-AttachmentPath -Reference $reference -DraftDirectory $draftDirectory -Root $root
  if (-not $source) {
    Write-Warning "Image not found: $reference"
    return $match.Value
  }
  $name = Split-Path $source -Leaf
  Copy-Item -LiteralPath $source -Destination (Join-Path $assetDir $name) -Force
  return "![$alt]({{ '/$assetDirRelative/$name' | relative_url }})"
})

$body = Normalize-DisplayMath -Markdown $body

$postRelative = "_posts/$datePrefix-$slug.md"
$postPath = Join-Path $root $postRelative
$published = "---`n$($yaml.Trim())`n---`n`n$body`n"
Set-Content -LiteralPath $postPath -Value $published -Encoding UTF8

$publishedDir = Join-Path $root "obsidian/Published"
New-Item -ItemType Directory -Force -Path $publishedDir | Out-Null
$publishedRelative = "obsidian/Published/$(Split-Path $draftFullPath -Leaf)"
Copy-Item -LiteralPath $draftFullPath -Destination (Join-Path $root $publishedRelative) -Force

if ($NoCommit -and $NoPush) {
  Write-PreviewManifest -Root $root -Paths @(
    $postRelative,
    $assetDirRelative,
    $publishedRelative
  )
}

Push-Location $root
try {
  npm run build
  if (-not $SkipTests) {
    npm run test:e2e
  }

  if (-not $NoCommit) {
    git add _posts assets/images obsidian/Published
    git add .
    $commitMessage = "post: $title"
    $changes = git status --short
    if ($changes) {
      git commit -m $commitMessage
      if (-not $NoPush) {
        git push
      }
    } else {
      Write-Host "No changes to commit."
    }
  }
}
finally {
  Pop-Location
}

Write-Host "Published: $postPath"
