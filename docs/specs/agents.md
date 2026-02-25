# agents.md — エージェントシステム・MCP・オーケストレーション仕様

上位ドキュメント: [ARCHITECTURE.md](../../ARCHITECTURE.md) > [system.md](./system.md)

---

## 1. 概要

S-IDEのエージェントシステムはAIを「固有の能力と役割を持つソフトウェア資産」として管理する（P-2, INV-3）。

すべてのエージェント間通信はMCPサーバー（`SIDEMCPServer`）を経由する。
直接的なモジュール間依存やグローバル変数による通信は禁止（INV-3, P-1+P-2）。

### 1.1. オーケストレーションモデル

S-IDEはエージェントを以下の3つの役割で分類する:

```
┌──────────────────────────────────────────────┐
│               S-IDE Core Daemon               │
│                                                │
│  [User Task]                                   │
│       │                                        │
│       ▼                                        │
│  ┌─────────────┐                               │
│  │ Orchestrator │ ← タスク分解・委譲・監視の主体  │
│  │ (内蔵)       │                               │
│  └──────┬──────┘                               │
│         │ MCP (INV-3)                          │
│    ┌────┼────────┐                             │
│    ▼    ▼        ▼                             │
│  ┌────┐ ┌────┐ ┌────┐                         │
│  │ A1 │ │ A2 │ │ A3 │  ← Worker Agents        │
│  └──┬─┘ └──┬─┘ └──┬─┘                         │
│     │      │      │                            │
│     ▼      ▼      ▼                            │
│  [PTY1] [PTY2] [PTY3]  ← MCP Tool経由で操作    │
│                                                │
│  [Observer] ← 全プロセス監視・閾値介入 (INV-6)  │
└──────────────────────────────────────────────┘
```

| 役割 | 責務 | INV/理念 |
|---|---|---|
| **Orchestrator** | ユーザーからタスクを受け取り、サブタスクに分解し、Worker Agentに委譲する。タスクの進捗を追跡し、完了を判定する。Core Daemonの**内蔵モジュール**として実装される。 | INV-3 (P-1+P-2) |
| **Worker Agent** | Orchestratorから委譲されたサブタスクを実行する。PTYへのコマンド送信、コード生成等の具体的な作業を担う。Claude, Codex等の外部AIモデル。 | INV-3, INV-5 |
| **Observer** | 全エージェントの実行状態を常時監視する。トークン使用量・コスト・実行時間の閾値を超えた場合に介入（警告→停止）する。Core Daemonの**内蔵モジュール**。 | INV-6 (P-1) |

**重要 (P-1 > P-2):** ObserverはOrchestratorよりも権限が高い。Observerが「停止」と判断した場合、Orchestratorの意図に関係なくプロセスは即座に遮断される。

### 1.2. オーケストレーションフロー

```
1. ユーザーがタスクを入力（UI or CLI）
2. Orchestrator がタスクを受け取る
3. Orchestrator がタスクをサブタスクに分解
4. Orchestrator が各サブタスクを適切な Worker Agent に MCP 経由で委譲
5. Worker Agent が MCP Tool 経由で PTY にコマンドを送信
6. Worker Agent が MCP Tool 経由で PTY 画面状態を取得（INV-5: 構造化データ）
7. Worker Agent が結果を Orchestrator に MCP 経由で返す
8. Observer が全ステップを監視（INV-6: 閾値超過で即時介入）
9. Orchestrator がサブタスク完了を確認し、次のサブタスクを委譲 or 全体完了を宣言
```

---

## 2. エージェント型システム

### 2.1. コア型定義

| 型 | 用途 |
|---|---|
| `AgentId` | エージェント識別子（例: `"claude"`, `"codex"`, `"copilot"` 等） |
| `AgentInfo` | メタデータ: id, name, icon, description, version, enabled, installed, configPath |
| `AgentConfig` | 設定: apiKey, apiEndpoint, model, temperature, maxTokens, mcpServers, skills |
| `MCPConfig` | MCPサーバー接続設定: id, name, command, args, env, enabled |
| `SkillConfig` | スキル定義: id, name, description, enabled, config |
| `AgentTask` | タスク定義: id, type (prompt/command/code/custom), content, options |
| `TaskResult` | 実行結果: taskId, success, output, error, metadata (tokens, cost, duration) |
| `AgentMessage` | メッセージ: id, from, to, timestamp, type (request/response/notification), content |
| `TaskHandoff` | タスク委譲: taskId, from, to, context, task |
| `SharedResource` | 共有リソース: id, type (mcp/skill/config), name, config, sharedWith |
| `AgentSubscription` | サブスクリプション: providerId, apiKey, expiresAt, remainingCredits, tier |
| `ProviderPricing` | 課金定義: providerId, model, inputTokenCost, outputTokenCost, currency |
| `UsageRecord` | 使用記録: agentId, sessionId, timestamp, inputTokens, outputTokens, cost, duration |

### 2.2. MCP Tools（エージェントが使用するツール）

エージェントがCore Daemonと対話するためのMCP Tools。
すべての操作はINV-3に従い、MCPサーバー経由で行われる。

#### 2.2.1. ターミナル操作ツール

| Tool Name | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `terminal_write` | sessionId, command | `{ success, exitHint? }` | PTYにコマンドを送信する |
| `terminal_read_screen` | sessionId | `{ screen, cursor, metadata }` | 現在の画面状態を取得する (INV-5: 構造化データ) |
| `terminal_read_diff` | sessionId, since? | `{ changes[], metadata }` | 前回取得からの差分を取得する |
| `terminal_read_summary` | sessionId | `{ summary, phase, health }` | 画面の要約テキストを取得する |
| `terminal_create` | workspaceId, shell? | `{ sessionId }` | 新しいターミナルセッションを作成する |
| `terminal_destroy` | sessionId | `{ success }` | ターミナルセッションを終了する |
| `terminal_list` | — | `{ sessions[] }` | アクティブなセッション一覧 |

#### 2.2.2. ファイル操作ツール

| Tool Name | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `file_read` | path | `{ content, encoding }` | ファイル内容を読み取る |
| `file_write` | path, content | `{ success }` | ファイルに書き込む |
| `file_list` | dirPath, recursive? | `{ entries[] }` | ディレクトリ内容を一覧する |
| `file_search` | query, path? | `{ matches[] }` | ファイル内検索 |

#### 2.2.3. エージェント間通信ツール

| Tool Name | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `agent_message` | to, content | `{ response }` | 別のエージェントにメッセージを送る |
| `agent_handoff` | to, task, context | `{ accepted }` | タスクを別のエージェントに委譲する |
| `agent_status` | agentId? | `{ status, usage }` | エージェントのステータスを取得する |

### 2.3. 新しいエージェントを追加する手順

```
1. AgentId に新しいIDを追加
2. AgentInterface を実装する構造体を作成
3. エージェントルートに registerAgent() で登録
4. SIDEMCPServer に handler を登録
5. INV-6: ステータスAPI + 強制停止APIを実装
6. ProviderPricing にモデルごとのトークン単価を定義
7. AgentDetector に検出ロジックを追加 (§6.3)
```

---

## 3. MCPサーバー

### 3.1. アーキテクチャ

`SIDEMCPServer` はシングルトン。全エージェント通信のハブとして機能する（INV-3）。

```
Agent A ─┐
Agent B ─┤
Agent C ─┼──► SIDEMCPServer (in-process) ──► handler dispatch
Agent D ─┤
Agent E ─┘
```

このアーキテクチャにより:
- **P-1:** すべての通信が記録可能・傍受可能・遮断可能
- **P-2:** エージェントの能力・設定・依存関係が体系的に管理される

### 3.2. API

| メソッド | 引数 | 用途 |
|---|---|---|
| `registerAgent(id, handler)` | AgentId, handler関数 | エージェント登録 |
| `unregisterAgent(id)` | AgentId | 登録解除 |
| `sendMessage(from, to, content)` | AgentId×2, content | 1対1メッセージ |
| `broadcastMessage(from, content, exclude?)` | AgentId, content, AgentId[] | ブロードキャスト |
| `handoffTask(handoff)` | TaskHandoff | タスク委譲 |
| `addSharedMCP(config)` | SharedMCPConfig | 共有MCP登録 |
| `addSharedSkill(config)` | SharedSkillConfig | 共有スキル登録 |
| `getSharedMCPsForAgent(id)` | AgentId | エージェント用MCP取得 |
| `getSharedSkillsForAgent(id)` | AgentId | エージェント用スキル取得 |
| `notifyAgentsOfSharedResourceChange(type, id)` | type, id | リソース変更通知 |

### 3.3. MCPサーバーライフサイクル管理

外部MCPサーバー（各エージェントが使用するツールサーバー）のライフサイクルを管理する。

```
[MCPサーバー登録]
      │
      ▼
[起動要求] ──► プロセスspawn ──► ヘルスチェック(初回)
      │                              │
      │                         [成功] → Running 状態
      │                         [失敗] → リトライ (max 3回) → Error 状態
      │
[Running状態]
      │
      ├── 定期ヘルスチェック (30秒間隔)
      │     │
      │     ├── [応答あり] → 継続
      │     └── [応答なし] → 再起動ポリシー判定
      │                        │
      │                   [auto-restart] → プロセス再起動
      │                   [manual]       → Error状態 + ユーザー通知
      │
      └── [停止要求] ──► SIGTERM ──► (5秒) ──► SIGKILL
```

| 状態 | 説明 |
|---|---|
| `Stopped` | 停止中。手動起動待ち |
| `Starting` | 起動中。ヘルスチェック待ち |
| `Running` | 正常稼働中 |
| `Error` | 異常終了。手動介入待ち or 自動リトライ中 |
| `Stopping` | グレースフル停止処理中 |

**起動順序:** MCPサーバー間に依存関係がある場合、`MCPConfig.dependsOn` フィールドで宣言し、依存先から順に起動する。

### 3.4. メッセージフロー

```
Agent A                  SIDEMCPServer              Agent B
   │                          │                        │
   │ sendMessage(A, B, data)─►│                        │
   │                          │ handler(message) ────►│
   │                          │   { id, from: A,       │
   │                          │     to: B,             │
   │                          │     type: "request",   │
   │                          │     content: data }    │
   │                          │                        │
   │                          │◄── AgentResponse ─────│
   │◄── return response ─────│                        │
```

---

## 4. 関連APIルート

| ルート | 責務 |
|---|---|
| `/api/agents` | エージェントCRUD・設定管理 |
| `/api/agents/:id/status` | 個別エージェントのステータス（INV-6） |
| `/api/agents/:id/usage` | 使用量・コスト情報 |
| `/api/agents/:id/subscription` | サブスクリプション状態 |
| `/api/bridge` | エージェント間通信ブリッジ |
| `/api/mcp-servers` | MCPサーバー設定管理 |
| `/api/mcp-servers/:id/status` | MCPサーバーの起動状態 |
| `/api/mcp-servers/:id/start` | MCPサーバー起動 |
| `/api/mcp-servers/:id/stop` | MCPサーバー停止 |
| `/api/shared-resources` | エージェント間共有リソース管理 |
| `/api/orchestrator/tasks` | オーケストレータのタスク一覧・状態 |

---

## 5. コスト監視・介入 (INV-6, P-1)

### 5.1. 使用量記録データモデル

すべてのエージェント実行は `UsageRecord` としてSQLiteに永続化される。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | UUID | レコードID |
| `agentId` | AgentId | 実行エージェント |
| `sessionId` | string | セッション識別子 |
| `timestamp` | datetime | 記録時刻 |
| `inputTokens` | int | 入力トークン数 |
| `outputTokens` | int | 出力トークン数 |
| `cost` | decimal | 概算コスト（USD） |
| `duration` | int | 実行時間（ミリ秒） |
| `model` | string | 使用モデル |
| `taskId` | string? | 関連タスクID |

### 5.2. プロバイダ課金抽象化

各AIプロバイダのトークン単価は `ProviderPricing` テーブルで管理する。

| フィールド | 型 | 説明 |
|---|---|---|
| `providerId` | string | プロバイダ識別子（`anthropic`, `openai` 等） |
| `model` | string | モデル名（`claude-sonnet-4-20250514`, `gpt-4o` 等） |
| `inputTokenCostPer1M` | decimal | 入力100万トークンあたりのコスト（USD） |
| `outputTokenCostPer1M` | decimal | 出力100万トークンあたりのコスト（USD） |
| `updatedAt` | datetime | 最終更新日時 |

**コスト計算式:**
```
cost = (inputTokens × inputTokenCostPer1M / 1,000,000)
     + (outputTokens × outputTokenCostPer1M / 1,000,000)
```

### 5.3. サブスクリプション管理

各エージェントのAPIキー・サブスクリプション状態を管理する。

| フィールド | 型 | 説明 |
|---|---|---|
| `agentId` | AgentId | エージェント |
| `providerId` | string | プロバイダ |
| `apiKey` | string (encrypted) | APIキー（暗号化保存） |
| `tier` | string | プラン（free/pro/enterprise等） |
| `expiresAt` | datetime? | 有効期限（nullは無期限） |
| `remainingCredits` | decimal? | 残クレジット（API対応時のみ） |
| `lastCheckedAt` | datetime | 最終有効性チェック日時 |
| `status` | enum | `active`, `expired`, `invalid`, `unknown` |

**APIキー有効性チェック:**
```
Core Daemon起動時にすべてのAPIキーの有効性を確認:
1. 各プロバイダのAPIに軽量リクエストを送信（models/list等）
2. 応答に基づいてstatus を更新
3. status=invalid のエージェントは自動的に enabled=false にする
4. チェック結果をイベントとしてフロントエンドに通知
```

### 5.4. 監視と介入

| 監視対象 | 閾値 | アクション | 理念 |
|---|---|---|---|
| トークン使用量 | セッション/日次上限 | 警告 → 強制停止 | P-1 (INV-6) |
| API呼び出し回数 | 分/時間あたり上限 | スロットリング → 遮断 | P-1 (INV-6) |
| 実行時間 | タスクあたり上限 | タイムアウト → 強制停止 | P-1 (INV-6) |
| 累計コスト | 日次/月次予算上限 | 警告 → 全エージェント停止 | P-1 (INV-6) |
| APIキー有効性 | 有効期限切れ | エージェント無効化 + 通知 | P-2 (INV-4) |

**P-1 > P-2:** Observer が「停止」と判断した場合、コスト効率やタスク完了の有無に関係なくプロセスは即座に遮断される。

---

## 6. エージェントライフサイクル管理

### 6.1. 設定アダプタパターン

各エージェントの設定ファイルフォーマットは異なるため、統一的な読み書きインターフェースを提供する。

```
S-IDE Unified Config API
         │
    ┌────┼────────┬──────────┐
    ▼    ▼        ▼          ▼
 Claude  Cursor   Codex    Copilot
 Adapter Adapter  Adapter  Adapter
    │    │        │          │
    ▼    ▼        ▼          ▼
 claude_ mcp.json .codex/   .github/
 desktop_         config    copilot-
 config.json               config.yml
```

| メソッド | 説明 |
|---|---|
| `detectConfigPath(agentId)` | 設定ファイルのパスをOS・インストール方法に応じて検出 |
| `readConfig(agentId)` | 設定ファイルを読み込み、統一的な `AgentConfig` に変換 |
| `writeConfig(agentId, config)` | `AgentConfig` を各エージェント固有のフォーマットに変換して書き込み |
| `validateConfig(agentId, config)` | 設定の整合性チェック（必須フィールド、値の範囲等） |
| `backupConfig(agentId)` | 書き換え前に既存設定のバックアップを作成 |

**重要:** 設定ファイルの書き換えは必ずバックアップを先に取る。書き換え失敗時はバックアップから復元する。

### 6.2. スキルインストールフロー

```
[スキル追加要求]
      │
      ▼
[バリデーション]
      │ スキル定義ファイルの構造チェック
      │ 必須フィールド確認
      │ 依存スキルの存在チェック
      │
      ▼
[インストール]
      │ スキルファイルを所定ディレクトリにコピー
      │ SkillConfig をDBに登録
      │
      ▼
[有効化]
      │ エージェントの skills[] に追加
      │ MCPサーバーの再読み込み通知
      │
      ▼
[検証]
      │ スキルのMCP Toolが正しく応答するかチェック
      └── [失敗] → スキルを無効化 + エラー通知
```

**スキルの配置:**
```
~/.side-ide/skills/
├── {skill-id}/
│   ├── skill.toml          # スキル定義（id, name, description, version, dependencies）
│   ├── tools/               # MCP Tool定義
│   └── resources/           # リソースファイル
```

### 6.3. エージェントインストール検出

各エージェントがシステムにインストール済みかどうかを検出するメカニズム。

| エージェント | 検出方法 |
|---|---|
| Claude | `claude` コマンドの存在（PATH検索） + `~/.claude/` の存在 |
| Codex | `codex` コマンドの存在（PATH検索） |
| Copilot | `gh copilot` コマンドの存在 + VS Code拡張の検出 |
| Cursor | `cursor` コマンドの存在 + アプリケーションの存在 |
| 汎用 | `MCPConfig.command` の実行可能性チェック |

**検出フロー:**
```
1. Core Daemon起動時に全登録エージェントの検出を実行
2. AgentInfo.installed フラグを更新
3. installed=false のエージェントは enabled にできない
4. 定期的な再検出（1時間間隔）で状態を最新に維持
5. 手動検出トリガー: /api/agents/detect
```

---

## 7. 関連ドキュメント

- [terminal-io.md](./terminal-io.md) — MCP Tool のターミナル操作の詳細実装
- [server.md](./server.md) — Core DaemonのAPIルート・永続化
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — INV-3, INV-5, INV-6 の定義
