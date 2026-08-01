param(
  [Parameter(Mandatory = $true, Position = 0)]
[string]$DraftPath,

[string]$CoverPath,

[string]$VaultRoot,

[string]$CoverPosition = "50% 50%",

[string]$DateOverride,

[string]$SlugOverride,

[switch]$NoCommit,
[switch]$NoPush
)

$ErrorActionPreference = "Stop"
$script:Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Write-Elapsed {
  $elapsed = $script:Stopwatch.Elapsed
  Write-Host "  ⏱ $([math]::Round($elapsed.TotalSeconds, 1))s elapsed"
}

function Convert-ToSlug {
  param([string]$Value)
  $words = ($Value.ToLowerInvariant() -split "[^\p{Ll}\p{Lu}\p{Nd}]+" | Where-Object { $_ })
  $slug = ($words | Select-Object -First 6) -join "-"
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
    [string]$Root,
    [string]$VaultRoot,
    [string]$AssetDir
  )

  $candidates = @()
  $candidates += Join-Path $DraftDirectory $Reference
  if ($VaultRoot) {
    $candidates += Join-Path $VaultRoot $Reference
  }
  $candidates += Join-Path $Root "obsidian/Attachments/$Reference"
  if ($AssetDir) {
    $candidates += Join-Path $AssetDir $Reference
  }
  $candidates += Join-Path $Root $Reference

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  # Published source notes keep their original Obsidian references, while the
  # first publish flattens attachments into this post's asset directory and
  # compresses PNG/JPEG files to WebP. Reuse that exact post-scoped copy before
  # falling back to a repository-wide filename search.
  if ($AssetDir) {
    $fileName = Split-Path $Reference -Leaf
    $assetCandidate = Join-Path $AssetDir $fileName
    if (Test-Path -LiteralPath $assetCandidate) {
      return (Resolve-Path -LiteralPath $assetCandidate).Path
    }

    if ([IO.Path]::GetExtension($fileName) -match '^\.(?i:png|jpe?g)$') {
      $webpName = [IO.Path]::GetFileNameWithoutExtension($fileName) + ".webp"
      $webpCandidate = Join-Path $AssetDir $webpName
      if (Test-Path -LiteralPath $webpCandidate) {
        return (Resolve-Path -LiteralPath $webpCandidate).Path
      }
    }
  }

  $fileName = Split-Path $Reference -Leaf
  $found = Get-ChildItem -Path (Join-Path $Root "assets/images/posts") -Recurse -File -Filter $fileName -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) {
    return $found.FullName
  }

  $found = Get-ChildItem -Path (Join-Path $Root "obsidian") -Recurse -File -Filter $fileName -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) {
    return $found.FullName
  }

  if ($VaultRoot) {
    $found = Get-ChildItem -Path $VaultRoot -Recurse -File -Filter $fileName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
      return $found.FullName
    }
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
if (-not [string]::IsNullOrWhiteSpace($DateOverride)) {
  $dateValue = $DateOverride
}
if ([string]::IsNullOrWhiteSpace($dateValue)) {
  $dateValue = $now.ToString("yyyy-MM-dd HH:mm:ss +0800")
}

$datePrefix = if ($dateValue -match "^(\d{4}-\d{2}-\d{2})") { $Matches[1] } else { $now.ToString("yyyy-MM-dd") }
$slug = Get-YamlValue -Yaml $yaml -Key "slug"
if (-not [string]::IsNullOrWhiteSpace($SlugOverride)) {
  $slug = $SlugOverride
}
if ([string]::IsNullOrWhiteSpace($slug)) {
  $slug = Convert-ToSlug -Value $title
}

# If a post with the same slug already exists, reuse its date prefix
# so re-publishing updates the same file instead of creating a duplicate.
$existing = Get-ChildItem -Path (Join-Path $root "_posts") -File -Filter "*-$slug.md" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
  $existingPrefix = if ($existing.BaseName -match "^(\d{4}-\d{2}-\d{2})-") { $Matches[1] } else { $null }
  if ($existingPrefix) {
    $datePrefix = $existingPrefix
    Write-Host "Found existing post with same slug, reusing date prefix: $datePrefix"
  }
}

# If the slug changed (e.g. manually renamed), match the old post by its
# source draft file or title so the article is replaced, not duplicated.
$draftLeaf = Split-Path $draftFullPath -Leaf
$oldPostToRemove = $null
if (-not $existing) {
  foreach ($candidate in Get-ChildItem -Path (Join-Path $root "_posts") -File -Filter "*.md" -ErrorAction SilentlyContinue) {
    $candidateFront = Get-FrontMatter -Content (Get-Content -Raw -Encoding UTF8 -LiteralPath $candidate.FullName)
    $candidateSource = Get-YamlValue -Yaml $candidateFront.Raw -Key "source_file"
    $candidateTitle = Get-YamlValue -Yaml $candidateFront.Raw -Key "title"
    if (($candidateSource -and $candidateSource -eq $draftLeaf) -or ($candidateTitle -and $candidateTitle -eq $title)) {
      if ($candidate.BaseName -match "^(\d{4}-\d{2}-\d{2})-") {
        $datePrefix = $Matches[1]
      }
      $oldPostToRemove = $candidate
      Write-Host "Found existing post with same source/title (old slug), replacing: $($candidate.Name)"
      break
    }
  }
}

# Once an article exists, its first published timestamp is authoritative.
# DateOverride remains useful only when creating a new article.
$matchedPost = if ($existing) { $existing } else { $oldPostToRemove }
if ($matchedPost) {
  $matchedFront = Get-FrontMatter -Content (Get-Content -Raw -Encoding UTF8 -LiteralPath $matchedPost.FullName)
  $publishedDate = Get-YamlValue -Yaml $matchedFront.Raw -Key "date"
  if (-not [string]::IsNullOrWhiteSpace($publishedDate)) {
    $dateValue = $publishedDate
    Write-Host "Preserving first published time: $dateValue"
  }

  # A source note does not necessarily contain the generated cover fields.
  # Keep them when updating the same post so a re-publish cannot drop its cover.
  if ($existing -and [string]::IsNullOrWhiteSpace((Get-YamlValue -Yaml $yaml -Key "cover"))) {
    $publishedCover = Get-YamlValue -Yaml $matchedFront.Raw -Key "cover"
    if ($publishedCover) {
      $yaml = Set-YamlValue -Yaml $yaml -Key "cover" -Value ('"{0}"' -f $publishedCover)
    }
  }
  if ($existing -and [string]::IsNullOrWhiteSpace((Get-YamlValue -Yaml $yaml -Key "cover_position"))) {
    $publishedCoverPosition = Get-YamlValue -Yaml $matchedFront.Raw -Key "cover_position"
    if ($publishedCoverPosition) {
      $yaml = Set-YamlValue -Yaml $yaml -Key "cover_position" -Value ('"{0}"' -f $publishedCoverPosition)
    }
  }
}

$categories = Get-YamlValue -Yaml $yaml -Key "categories"
if ([string]::IsNullOrWhiteSpace($categories)) {
  $categories = "[" + [char]0x968F + [char]0x7B14 + "]"
}
$yaml = Set-YamlValue -Yaml $yaml -Key "categories" -Value $categories
$yaml = Set-YamlValue -Yaml $yaml -Key "date" -Value $dateValue
$yaml = Set-YamlValue -Yaml $yaml -Key "slug" -Value ('"{0}"' -f $slug)
$yaml = Set-YamlValue -Yaml $yaml -Key "source_file" -Value ('"{0}"' -f $draftLeaf)

$isMoments = $categories -match "moments"
if (-not $isMoments) {
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
  $yaml = Set-YamlValue -Yaml $yaml -Key "summary" -Value ('"{0}"' -f $summary)
}

$assetDirRelative = "assets/images/posts/$datePrefix-$slug"
$assetDir = Join-Path $root $assetDirRelative
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

# When replacing a post whose slug changed, carry its assets forward so
# compressed images and the cover survive the rename.
if ($oldPostToRemove) {
  $oldAssetDirCarry = Join-Path $root "assets/images/posts/$($oldPostToRemove.BaseName)"
  if ((Test-Path -LiteralPath $oldAssetDirCarry) -and ($oldAssetDirCarry -ne $assetDir)) {
    Copy-Item -Path (Join-Path $oldAssetDirCarry "*") -Destination $assetDir -Recurse -Force
  }
  if ([string]::IsNullOrWhiteSpace((Get-YamlValue -Yaml $yaml -Key "cover"))) {
    $oldFront = Get-FrontMatter -Content (Get-Content -Raw -Encoding UTF8 -LiteralPath $oldPostToRemove.FullName)
    $oldCover = Get-YamlValue -Yaml $oldFront.Raw -Key "cover"
    if ($oldCover) {
      $newCover = $oldCover -replace [regex]::Escape("/assets/images/posts/$($oldPostToRemove.BaseName)/"), "/$assetDirRelative/"
      $yaml = Set-YamlValue -Yaml $yaml -Key "cover" -Value ('"{0}"' -f $newCover)
      $oldCoverPosition = Get-YamlValue -Yaml $oldFront.Raw -Key "cover_position"
      if ($oldCoverPosition -and [string]::IsNullOrWhiteSpace((Get-YamlValue -Yaml $yaml -Key "cover_position"))) {
        $yaml = Set-YamlValue -Yaml $yaml -Key "cover_position" -Value ('"{0}"' -f $oldCoverPosition)
      }
    }
  }
}

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
  $source = Resolve-AttachmentPath -Reference $reference -DraftDirectory $draftDirectory -Root $root -VaultRoot $VaultRoot -AssetDir $assetDir
  if (-not $source) {
    Write-Warning "Image not found: $reference"
    return $match.Value
  }
  $name = Split-Path $source -Leaf
  $dest = Join-Path $assetDir $name
  if ((Resolve-Path -LiteralPath $source).Path -ne (Resolve-Path -LiteralPath $dest -ErrorAction SilentlyContinue).Path) {
    Copy-Item -LiteralPath $source -Destination $dest -Force
  }
  return "![]({{ '/$assetDirRelative/$name' | relative_url }})"
})

$body = [regex]::Replace($body, '!\[([^\]]*)\]\(([^)]+)\)', {
  param($match)
  $alt = $match.Groups[1].Value
  $reference = $match.Groups[2].Value
  if ($reference -match '^(https?:)?//|^\{\{') {
    return $match.Value
  }
  $source = Resolve-AttachmentPath -Reference $reference -DraftDirectory $draftDirectory -Root $root -VaultRoot $VaultRoot -AssetDir $assetDir
  if (-not $source) {
    Write-Warning "Image not found: $reference"
    return $match.Value
  }
  $name = Split-Path $source -Leaf
  $dest = Join-Path $assetDir $name
  if ((Resolve-Path -LiteralPath $source).Path -ne (Resolve-Path -LiteralPath $dest -ErrorAction SilentlyContinue).Path) {
    Copy-Item -LiteralPath $source -Destination $dest -Force
  }
  return "![$alt]({{ '/$assetDirRelative/$name' | relative_url }})"
})

# --- Image compression ---
try {
  $compressResult = & node scripts/compress-images.js --dir $assetDir 2>&1
  $compressResult | ForEach-Object { Write-Host $_ }
} catch {
  Write-Warning "图片压缩失败（文章仍会正常发布）：$($_.Exception.Message)"
}

# Replace compressed image references with WebP paths (originals deleted).
# Rewrite based on what actually exists on disk rather than parsing the node
# child process stdout: PowerShell decodes external-process output using the
# console encoding, which mangles non-ASCII (e.g. Chinese) filenames and made
# the .png -> .webp rewrite silently fail for those references.
$escapedDir = [regex]::Escape($assetDirRelative)
$body = [regex]::Replace(
  $body,
  "!\[([^\]]*)\]\(\{\{\s*'/$escapedDir/([^']+?)\.(?:png|jpe?g)'\s*\|\s*relative_url\s*\}\}\)",
  {
    param($m)
    $alt = $m.Groups[1].Value
    $base = $m.Groups[2].Value
    $webpName = "$base.webp"
    if (Test-Path -LiteralPath (Join-Path $assetDir $webpName)) {
      return "![$alt]({{ '/$assetDirRelative/$webpName' | relative_url }})"
    }
    return $m.Value
  },
  [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

# Update cover path if compressed to WebP
if ($yaml -match 'cover:\s*"(/assets/images/posts/[^"]+)\.(?i:png|jpe?g)"') {
  $coverBase = $matches[1]
  $coverWebp = "$coverBase.webp"
  $coverFile = Split-Path $coverWebp -Leaf
  if (Test-Path -LiteralPath (Join-Path $assetDir $coverFile)) {
    $yaml = $yaml -replace 'cover:\s*"/assets/images/posts/[^"]+"', ('cover: "{0}"' -f $coverWebp)
  }
}

$body = Normalize-DisplayMath -Markdown $body

$postRelative = "_posts/$datePrefix-$slug.md"
$postPath = Join-Path $root $postRelative
$published = "---`n$($yaml.Trim())`n---`n`n$body`n"
Set-Content -LiteralPath $postPath -Value $published -Encoding UTF8

if ($oldPostToRemove -and $oldPostToRemove.FullName -ne $postPath) {
  Remove-Item -LiteralPath $oldPostToRemove.FullName -Force
  $oldAssetDir = Join-Path $root "assets/images/posts/$($oldPostToRemove.BaseName)"
  if ((Test-Path -LiteralPath $oldAssetDir) -and ($oldAssetDir -ne $assetDir)) {
    Remove-Item -LiteralPath $oldAssetDir -Recurse -Force
  }
  Write-Host "Removed old post: $($oldPostToRemove.Name)"
}

$publishedDir = Join-Path $root "obsidian/Published"
New-Item -ItemType Directory -Force -Path $publishedDir | Out-Null
$publishedRelative = "obsidian/Published/$(Split-Path $draftFullPath -Leaf)"
$publishedFullPath = Join-Path $root $publishedRelative
if ((Resolve-Path -LiteralPath $draftFullPath).Path -ne (Resolve-Path -LiteralPath $publishedFullPath -ErrorAction SilentlyContinue).Path) {
  Copy-Item -LiteralPath $draftFullPath -Destination $publishedFullPath -Force
}

if ($NoCommit -and $NoPush) {
  Write-PreviewManifest -Root $root -Paths @(
    $postRelative,
    $assetDirRelative,
    $publishedRelative
  )
}

# Build site (skip in preview mode for faster iteration)
if (-not ($NoCommit -and $NoPush)) {
  npm run build
}

if (-not $NoCommit) {
  git add _posts assets/images obsidian/Published
  git add .
  $commitMessage = "post: $title"
  $changes = git status --short
  if ($changes) {
    git commit -m $commitMessage
    if (-not $NoPush) {
      git -c http.sslBackend=openssl push origin main
    }
  } else {
    Write-Host "No changes to commit."
  }
}

Write-Host "Published: $postPath"
Write-Elapsed
