#!/usr/bin/env pwsh
# Dドライブ(exFAT)でシンボリックリンクを使わずにインストールするスクリプト

Write-Host "Installing without symlinks..." -ForegroundColor Green

# 1. packages/shared をビルド
Write-Host "Building shared package..." -ForegroundColor Yellow
Set-Location -Path ".\packages\shared"
npm install
npm run build
Set-Location -Path "..\.."

# 2. apps/server にインストール（ワークスペースリンクなし）
Write-Host "Installing server dependencies..." -ForegroundColor Yellow
Set-Location -Path ".\apps\server"
npm install

# sharedパッケージを手動コピー
$sharedSource = "..\..\packages\shared"
$sharedTarget = ".\node_modules\@side-ide\shared"
if (Test-Path $sharedTarget) {
    Remove-Item -Recurse -Force $sharedTarget
}
New-Item -ItemType Directory -Path $sharedTarget -Force | Out-Null
Copy-Item -Path "$sharedSource\*" -Destination $sharedTarget -Recurse -Force
Set-Location -Path "..\.."

# 3. apps/web にインストール
Write-Host "Installing web dependencies..." -ForegroundColor Yellow
Set-Location -Path ".\apps\web"
npm install

# sharedパッケージを手動コピー
$sharedSource = "..\..\packages\shared"
$sharedTarget = ".\node_modules\@side-ide\shared"
if (Test-Path $sharedTarget) {
    Remove-Item -Recurse -Force $sharedTarget
}
New-Item -ItemType Directory -Path $sharedTarget -Force | Out-Null
Copy-Item -Path "$sharedSource\*" -Destination $sharedTarget -Recurse -Force
Set-Location -Path "..\.."

Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  pnpm run dev:server  # Start server"
Write-Host "  pnpm run dev:web     # Start web (in another terminal)"
