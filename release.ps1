<#
.SYNOPSIS
  Release a specific package with auto or manual version bumping.

.DESCRIPTION
  Bumps the version (minor by default), commits, and pushes to trigger the publish workflow.

.PARAMETER Package
  Package directory name under packages/ (e.g. ngx-consent, cdk-cognito-branding, consent-setup)

.PARAMETER Version
  Optional specific version (e.g. 1.2.3). If omitted, auto-bumps minor.

.PARAMETER Bump
  Version bump type: major, minor (default), or patch. Ignored if Version is specified.

.EXAMPLE
  .\release.ps1 ngx-consent                  # 0.0.1 → 0.1.0
  .\release.ps1 ngx-consent -Bump patch      # 0.1.0 → 0.1.1
  .\release.ps1 ngx-consent -Version 2.0.0   # → 2.0.0
#>

param(
  [Parameter(Mandatory, Position = 0)]
  [ValidateSet('ngx-consent', 'cdk-cognito-branding', 'consent-setup', 'style')]
  [string]$Package,

  [Parameter(Position = 1)]
  [string]$Version,

  [ValidateSet('major', 'minor', 'patch')]
  [string]$Bump = 'minor'
)

$ErrorActionPreference = 'Stop'

$packageDir = Join-Path $PSScriptRoot "packages/$Package"
$packageJson = Join-Path $packageDir "package.json"

if (-not (Test-Path $packageJson)) {
  Write-Error "Package not found: $packageJson"
  exit 1
}

$pkg = Get-Content $packageJson -Raw | ConvertFrom-Json
$currentVersion = $pkg.version
Write-Host "Current version: $currentVersion" -ForegroundColor Cyan

if ($Version) {
  $newVersion = $Version
} else {
  $parts = $currentVersion.Split('.')
  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  $patch = [int]$parts[2]

  switch ($Bump) {
    'major' { $major++; $minor = 0; $patch = 0 }
    'minor' { $minor++; $patch = 0 }
    'patch' { $patch++ }
  }

  $newVersion = "$major.$minor.$patch"
}

Write-Host "New version:     $newVersion" -ForegroundColor Green

# Update package.json
$pkg.version = $newVersion
# Use npm version to update cleanly (preserves JSON formatting)
Push-Location $packageDir
npm version $newVersion --no-git-tag-version | Out-Null
Pop-Location

# Commit and push
git add $packageJson (Join-Path $PSScriptRoot "package-lock.json")
git commit -m "release(@olopad/$Package): v$newVersion"
git push origin main

Write-Host ""
Write-Host "Released @olopad/$Package@$newVersion" -ForegroundColor Green
Write-Host "The publish workflow will now build and publish to npm." -ForegroundColor Gray
