## 概要

`agents.md` §1.1 で定義されている **Orchestrator** と **Observer** モジュールが、サーバーコードベースに全く存在しない。これらはS-IDEの中核的なP-1保証を担う最重要コンポーネントである。

## ドキュメントの要求

### Orchestrator (agents.md §1.1)
- ユーザーからタスクを受け取り、サブタスクに分解
- 適切な Worker Agent に MCP 経由で委譲
- タスクの進捗を追跡し、完了を判定
- Core Daemon の **内蔵モジュール** として実装

### Observer (agents.md §1.1)
- 全エージェントの実行状態を常時監視
- トークン使用量・コスト・実行時間の閾値監視
- 閾値超過で介入（警告 → 強制停止）
- Core Daemon の **内蔵モジュール** として実装
- **Orchestratorよりも権限が高い** (P-1 > P-2)

### 現状
- `grep -r "orchestrator"` → 該当なし
- `grep -r "observer"` → 該当なし
- `system.md` のレイヤー図に `Orchestrator + Observer (MCP Router)` として記載

## 影響するINV

- **INV-6 (Observable & Interruptible, P-1):** Observer は INV-6 の直接実現。これがなければエージェントの暴走を検知・停止できない
- **INV-3 (MCP Universal Contract):** Orchestrator は MCP 経由の通信契約を管理するルーター
- **P-1 > P-2 の保証:** Observer が Orchestrator よりも優位であることを実装レベルで保証する必要がある

## 受け入れ基準

- [ ] Orchestrator モジュールの実装（タスク分解・委譲・追跡）
- [ ] Observer モジュールの実装（監視・閾値介入）
- [ ] Observer が Orchestrator をオーバーライドして強制停止可能
- [ ] `/api/orchestrator/tasks` エンドポイントの実装
- [ ] 実行状態のリアルタイム取得API

## 対象ファイル

- `apps/server/src/` (新規モジュール作成)
- `apps/server/src/routes/` (オーケストレータルート)
