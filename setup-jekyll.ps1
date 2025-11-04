# Jekyll Setup Script for BoxBuilder Docs
# Run this after Ruby installation completes and you've reopened your terminal

Write-Host "=== BoxBuilder Jekyll Setup ===" -ForegroundColor Cyan

# Step 1: Verify Ruby
Write-Host "`n1. Checking Ruby installation..." -ForegroundColor Yellow
try {
    $rubyVersion = ruby --version
    Write-Host "   ✓ Ruby installed: $rubyVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Ruby not found. Please close and reopen your terminal after installation." -ForegroundColor Red
    exit 1
}

# Step 2: Install Bundler
Write-Host "`n2. Installing Bundler..." -ForegroundColor Yellow
gem install bundler
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Bundler installed successfully" -ForegroundColor Green
} else {
    Write-Host "   ✗ Bundler installation failed" -ForegroundColor Red
    exit 1
}

# Step 3: Navigate to docs directory
Write-Host "`n3. Setting up Jekyll in docs directory..." -ForegroundColor Yellow
Set-Location docs

# Step 4: Configure bundle path
Write-Host "   Configuring local bundle path..." -ForegroundColor Yellow
bundle config set --local path ../.bundle

# Step 5: Install Jekyll and dependencies
Write-Host "   Installing Jekyll and dependencies (this may take a few minutes)..." -ForegroundColor Yellow
bundle install

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Setup complete!" -ForegroundColor Green
    Write-Host "`nTo start the Jekyll dev server, run:" -ForegroundColor Cyan
    Write-Host "   cd docs" -ForegroundColor White
    Write-Host "   bundle exec jekyll serve" -ForegroundColor White
    Write-Host "`nThen visit: http://localhost:4000/BoxBuilder/" -ForegroundColor Cyan
} else {
    Write-Host "`n✗ Bundle install failed. Check errors above." -ForegroundColor Red
    exit 1
}
