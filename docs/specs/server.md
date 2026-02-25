# server.md — Core Daemon 仕様

上位ドキュメント: [ARCHITECTURE.md](../../ARCHITECTURE.md) > [system.md](./system.md)

---

## 1. 概要

Core DaemonはS-IDEの全ビジネスロジックを担う**Rust製ヘッドレスバックエンド**。
CLIバイナリとして単独起動可能であること（INV-1, P-1）。

**技術スタック:** Rust, tokio, axum, sqlx, portable-pty, clap

## 2. CLIコマンド体系

Core Daemon (`side-core`) は `clap` ベースのCLIとして以下のサブコマンドを提供する。

### 2.1. コマンド一覧

```
side-core
├── serve                  # デーモンモード（HTTP/WSサーバー起動）
│   ├── --port <PORT>      # ポート指定 (default: 8787)
│   ├── --host <HOST>      # ホスト指定 (default: 0.0.0.0)
│   └── --config <PATH>    # 設定ファイルパス
│
├── status                 # Daemonのステータス確認（ポート、PID、稼働時間）
│
├── agent                  # エージェント管理
│   ├── list               # 登録エージェント一覧
│   ├── status [AGENT_ID]  # エージェントステータス
│   ├── detect             # インストール済みエージェント検出
│   ├── enable <AGENT_ID>  # エージェント有効化
│   └── disable <AGENT_ID> # エージェント無効化
│
├── terminal               # ターミナル管理
│   ├── list               # アクティブセッション一覧
│   ├── create [--shell]   # 新規セッション作成
│   └── kill <SESSION_ID>  # セッション強制終了
│
├── mcp                    # MCPサーバー管理
│   ├── list               # 登録MCPサーバー一覧
│   ├── status [SERVER_ID] # MCPサーバーステータス
│   ├── start <SERVER_ID>  # MCPサーバー起動
│   └── stop <SERVER_ID>   # MCPサーバー停止
│
├── config                 # 設定管理
│   ├── get [KEY]          # 設定値取得
│   ├── set <KEY> <VALUE>  # 設定値変更
│   └── validate           # 設定ファイル検証
│
├── usage                  # 使用量・コスト確認
│   ├── summary            # 全体サマリ
│   ├── agent <AGENT_ID>   # エージェント別詳細
│   └── export [--format]  # CSV/JSONエクスポート
│
└── version                # バージョン情報
```

### 2.2. デーモンモードとCLIモードの関係

```
┌────────────────────────────────────────────────┐
│              side-core バイナリ                  │
│                                                  │
│  [side-core serve]     ← デーモンモード          │
│       │                   HTTP/WSサーバーを起動   │
│       │                   バックグラウンドで常駐   │
│       │                   全機能をAPIで提供       │
│       │                                          │
│  [side-core <subcommand>] ← CLIモード            │
│       │                   単発実行して終了         │
│       │                   稼働中Daemonに接続      │
│       │                   or 直接DB/設定アクセス  │
│                                                  │
│  動作パターン:                                    │
│  A) Daemon非稼働時: 直接DB/設定にアクセスして応答  │
│  B) Daemon稼働時: localhost:PORT のAPIに委譲      │
└────────────────────────────────────────────────┘
```

**INV-1準拠:** すべてのCLIコマンドはUI不要。`side-core serve` で全機能がHeadlessで動作する。
**INV-6準拠:** `side-core status` で外部から常に稼働状態を確認可能。

## 3. 設計原則

Core Daemonの設計は以下の原則に従う（ARCHITECTURE.md §2, §3 より導出）:

| 原則 | INV | 理念 | Core Daemonでの意味 |
|---|---|---|---|
| Headless-First | INV-1 | P-1 | UIプロセスなしで全機能が動作する |
| 決定論的I/O | INV-2 | P-1 | 同じ入力に対して同じ出力を返す |
| MCP経由通信 | INV-3 | P-1+P-2 | エージェント間はMCPServerのみ |
| 宣言的設定 | INV-4 | P-2 | env → file → defaultのチェーン |
| 可観測性 | INV-6 | P-1 | 全プロセスの状態取得+強制停止API |

## 4. 設定解決チェーン (INV-4)

```
環境変数               ← 最優先
    ↓
設定ファイル(TOML/JSON) ← ファイルベース設定
    ↓
default値              ← フォールバック
```

| 設定値 | 環境変数 | default |
|---|---|---|
| ポート | `PORT` | `8787` |
| ホスト | `HOST` | `0.0.0.0` |
| デフォルトルート | `DEFAULT_ROOT` | ホームディレクトリ |
| 最大ファイルサイズ | `MAX_FILE_SIZE` | `10485760` (10MB) |
| ターミナルバッファ上限 | `TERMINAL_BUFFER_LIMIT` | `50000` |
| リクエストボディ上限 | `MAX_REQUEST_BODY_SIZE` | `1048576` (1MB) |
| 認証ユーザー | `AUTH_USER` | なし |
| 認証パスワード | `AUTH_PASSWORD` | なし |
| CORSオリジン | `CORS_ORIGIN` | なし |

**本番環境制約:**
- `CORS_ORIGIN` 必須
- `AUTH_USER` + `AUTH_PASSWORD` 必須
- パスワード12文字以上 + 弱パスワードチェック

## 5. APIルーティング

### 5.1. システムエンドポイント

| プレフィックス | 責務 | INV |
|---|---|---|
| `/api/health` | ヘルスチェック（起動状態、DB接続、使用ポート） | INV-6 |
| `/api/health/ports` | 使用中ポート一覧（Core Daemon + MCPサーバー） | INV-6 |
| `/api/env-check` | 環境チェック | INV-4 |
| `/api/settings` | アプリ設定管理 | INV-4 |

### 5.2. ヘルスチェック応答 (`/api/health`)

```json
{
  "status": "healthy",
  "uptime": 3600,
  "pid": 12345,
  "version": "0.1.0",
  "ports": {
    "http": 8787,
    "ws": 8787
  },
  "database": "connected",
  "mcpServers": {
    "running": 3,
    "error": 0,
    "stopped": 1
  },
  "agents": {
    "enabled": 4,
    "installed": 3
  }
}
```

### 5.3. ポート監視 (`/api/health/ports`)

```json
{
  "coreDaemon": { "port": 8787, "status": "listening" },
  "mcpServers": [
    { "id": "filesystem", "port": 3001, "status": "listening" },
    { "id": "git", "port": 3002, "status": "listening" }
  ],
  "conflicts": []
}
```

### 5.4. ビジネスエンドポイント

| プレフィックス | 責務 |
|---|---|
| `/api/workspaces` | ワークスペースCRUD |
| `/api/decks` | デッキCRUD |
| `/api/files`, `/api/file`, `/api/dir` | ファイルシステム操作 |
| `/api/terminals` | ターミナルセッションCRUD + PTY管理 |
| `/api/git` | Git操作 |
| `/api/agents` | エージェントCRUD・設定管理 |
| `/api/bridge` | エージェント間MCP通信 |
| `/api/context-manager` | コンテキストヘルス監視 |
| `/api/mcp-servers` | MCPサーバー設定管理 |
| `/api/local-servers` | ローカルサーバー検出 |
| `/api/shells` | 利用可能シェル一覧 |
| `/api/tabs` | タブ状態管理 |
| `/api/tunnel` | ローカルトンネル |
| `/api/shared-resources` | 共有リソース管理 |
| `/api/orchestrator/tasks` | オーケストレータのタスク管理 |

### 5.5. 新しいルートを追加する手順

```
1. 対応するハンドラモジュールを作成
2. ルーターに登録
3. 入力バリデーション + エラーハンドリングを実装
4. パストラバーサル検証が必要ならパスバリデーションモジュールを使用
5. INV-2: モック入力に対するテストを追加
```

## 6. ミドルウェアチェーン

**適用順序（変更禁止）:**

```
securityHeaders → cors → requestId → bodyLimit → rateLimit → auth → csrfProtection
```

**新しいミドルウェアを追加する場合:**
- セキュリティ関連 → securityHeadersの直後
- 認証/認可関連 → authの後
- チェーン順序を変更する場合は、理由を明記しレビューを受けること

## 7. 永続化

| データストア | 格納内容 |
|---|---|
| SQLite | Workspaces, Decks, Terminals, Context Manager, **UsageRecords, ProviderPricing, AgentSubscription** |
| 設定ファイル(TOML/JSON) | ポート、認証設定 |

**起動時チェック:**
- DBの整合性チェック
- 破損時はバックアップ作成 + 新規作成
- dataディレクトリの自動作成
- **APIキー有効性チェック（agents.md §5.3参照）**

## 8. グレースフルシャットダウン

```
1. 全エージェントプロセスに停止通知（Observer経由）
2. 全MCPサーバーにSIGTERM送信
3. 全ターミナルセッションのバッファをSQLiteに保存
4. 使用量レコードをフラッシュ
5. DB接続をクローズ
6. HTTPサーバーを停止
```

INV-6（P-1）: シャットダウン中も外部からの強制停止が可能であること。
