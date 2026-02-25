## 概要

`server.md` §2 で定義されている CLI コマンド体系のうち、実際に実装されているのは `start` サブコマンドのみ。ドキュメントに定義された大半のコマンドが未実装。

## 現状

### 実装済み
- `side-server start` (= ドキュメントの `side-core serve` に相当)

### 未実装（ドキュメントに定義済み）
- `status` — Daemonのステータス確認（ポート、PID、稼働時間）
- `agent list` — 登録エージェント一覧
- `agent status [AGENT_ID]` — エージェントステータス
- `agent detect` — インストール済みエージェント検出
- `agent enable/disable` — エージェント有効化/無効化
- `terminal list` — アクティブセッション一覧
- `terminal create` — 新規セッション作成
- `terminal kill` — セッション強制終了
- `mcp list/status/start/stop` — MCPサーバー管理
- `config get/set/validate` — 設定管理
- `usage summary/agent/export` — 使用量・コスト確認
- `version` — バージョン情報

### バイナリ名の不一致
- ドキュメント: `side-core`
- 実装: `side-server`

## 影響するINV

- **INV-1 (Headless-First, P-1):** CLIからの全機能操作がHeadless-First保証の検証基準。CLIが不完全ではINV-1を満たさない
- **INV-6 (Observable & Interruptible, P-1):** `status` コマンドがなければ外部からの可観測性が損なわれる

## 受け入れ基準

- [ ] `side-core status` で稼働状態を確認可能
- [ ] `side-core agent list/status/detect/enable/disable` でエージェント管理可能
- [ ] `side-core terminal list/create/kill` でターミナル管理可能
- [ ] `side-core mcp list/status/start/stop` でMCPサーバー管理可能
- [ ] `side-core config get/set/validate` で設定管理可能
- [ ] `side-core usage summary` で使用量確認可能
- [ ] `side-core version` でバージョン表示
- [ ] Daemon稼働中はAPI委譲、非稼働時は直接DB/設定アクセス

## 対象ファイル

- `apps/server/src/cli.ts`
- `apps/server/src/commands/` (現在 `start.ts` のみ)
