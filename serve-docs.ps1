# Quick Jekyll serve helper for BoxBuilder docs
# Usage: PowerShell from repo root
#   ./serve-docs.ps1

$ErrorActionPreference = 'Stop'
Write-Host "Launching Jekyll (GitHub Pages environment)..." -ForegroundColor Cyan

if (-not (Test-Path -Path './docs/Gemfile')) {
  Write-Host "Docs Gemfile not found. Run from repo root." -ForegroundColor Red
  exit 1
}

# Ensure bundle path config stays consistent
Push-Location docs
try {
  bundle config set --local path ../.bundle | Out-Null
  Write-Host "Bundle path set to ../.bundle" -ForegroundColor DarkGray
  Write-Host "Starting server on http://127.0.0.1:4000/BoxBuilder/" -ForegroundColor Green
  bundle exec jekyll serve --port 4000 --baseurl /BoxBuilder
} finally {
  Pop-Location
}
