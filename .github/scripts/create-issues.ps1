#!/usr/bin/env pwsh
# Create GitHub issues for S-IDE Architecture gap analysis

$ErrorActionPreference = "Continue"
$basePath = $PSScriptRoot + "/../issue-bodies"

Write-Host "Creating Issue 1: Tech Stack Mismatch..."
gh issue create `
  --title "[Architecture] ドキュメントの技術スタック記述と実態の不一致" `
  --label "architecture,documentation,P-1:critical" `
  --body-file "$basePath/issue-01-tech-stack.md"

Write-Host "Creating Issue 2: Mobile Strategy..."
gh issue create `
  --title "[Architecture] モバイル方針の矛盾 — React Native/Expo vs PWA" `
  --label "architecture,documentation,P-1:critical" `
  --body-file "$basePath/issue-02-mobile.md"

Write-Host "Creating Issue 3: CLI Commands..."
gh issue create `
  --title "[INV-1/INV-6] CLIコマンド体系の実装 — Headless-First保証" `
  --label "architecture,enhancement,P-1:critical" `
  --body-file "$basePath/issue-03-cli.md"

Write-Host "Creating Issue 4: Health Check..."
gh issue create `
  --title "[INV-6] ヘルスチェックAPI (/api/health) の実装" `
  --label "architecture,enhancement,P-1:critical" `
  --body-file "$basePath/issue-04-health.md"

Write-Host "Creating Issue 5: Orchestrator/Observer..."
gh issue create `
  --title "[INV-6/INV-3] Orchestrator・Observer モジュールの実装" `
  --label "architecture,enhancement,P-1:critical" `
  --body-file "$basePath/issue-05-orchestrator-observer.md"

Write-Host "Creating Issue 6: Screen Buffer..."
gh issue create `
  --title "[INV-5/INV-6] Screen Buffer 抽象化レイヤーの実装" `
  --label "architecture,enhancement,P-1:critical" `
  --body-file "$basePath/issue-06-screen-buffer.md"

Write-Host "Creating Issue 7: Cost Monitoring..."
gh issue create `
  --title "[INV-6/P-2] コスト監視・UsageRecord/ProviderPricing の実装" `
  --label "architecture,enhancement,P-2:standard" `
  --body-file "$basePath/issue-07-cost-monitoring.md"

Write-Host "Creating Issue 8: Middleware/Shutdown..."
gh issue create `
  --title "[INV-2/INV-6] ミドルウェアチェーン完全化とグレースフルシャットダウン" `
  --label "architecture,enhancement,P-1:critical" `
  --body-file "$basePath/issue-08-middleware-shutdown.md"

Write-Host "Creating Issue 9: Duplicate JS files..."
gh issue create `
  --title "[Tech Debt] apps/server/src/ 配下の .js/.ts 重複ファイル整理 (21ファイル)" `
  --label "tech-debt,enhancement" `
  --body-file "$basePath/issue-09-duplicate-js.md"

Write-Host "Done!"
