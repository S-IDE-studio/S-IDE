# system.md — システム境界・レイヤー構造・プロセスモデル

上位ドキュメント: [ARCHITECTURE.md](../../ARCHITECTURE.md)

---

## 1. レイヤー構造

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │  Desktop App  │  │   Web PWA    │  │    Mobile (PWA)        │    │
│  │  (Tauri 2.0)  │  │ (React+Vite) │  │  (Responsive Web)     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘    │
│         │                 │                      │                  │
│         └─────────────────┼──────────────────────┘                  │
│                           │ HTTP / WebSocket                        │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────────┐
│              Core Daemon Layer (Headless / Rust)                     │
│                           │                                         │
│  ┌────────────────────────▼────────────────────────────────────┐   │
│  │           HTTP/WS Server (Rust / side-core serve)           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐                  │   │
│  │  │ REST API │ │ WS Server│ │ Middleware  │                  │   │
│  │  └────┬─────┘ └────┬─────┘ └──────┬─────┘                  │   │
│  └───────┼─────────────┼──────────────┼────────────────────────┘   │
│          │             │              │                             │
│  ┌───────▼─────────────▼──────────────▼────────────────────────┐   │
│  │                     Service Layer                            │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │   │
│  │  │ Orchestrator │ │ PTY Manager  │ │  Context Manager     │ │   │
│  │  │ + Observer   │ │ (portable-pty│ │                      │ │   │
│  │  │ (MCP Router) │ │  / tokio)    │ │                      │ │   │
│  │  └──────┬───────┘ └──────┬───────┘ └──────────────────────┘ │   │
│  │         │                │                                   │   │
│  │  ┌──────▼───────┐ ┌──────▼───────┐ ┌──────────────────────┐ │   │
│  │  │ MCP Server   │ │ Terminal     │ │ Git Ops / File Ops   │ │   │
│  │  │ (Singleton)  │ │ Sessions +   │ │                      │ │   │
│  │  │              │ │ Screen Buffer│ │                      │ │   │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │   │
│  │  ┌───────────────────────────────────────────────────────┐   │   │
│  │  │     Persistence (SQLite + TOML/JSON)                   │   │   │
│  │  │     UsageRecords / ProviderPricing / Subscriptions     │   │   │
│  │  └───────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            Tauri Rust Shell (Desktop Only)                    │   │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────────────────┐ │   │
│  │  │ Daemon     │ │ Scanner    │ │ Remote Access            │ │   │
│  │  │ Lifecycle  │ │ (Port/Nmap)│ │ (Tailscale/Tunnel)       │ │   │
│  │  └────────────┘ └────────────┘ └──────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. レイヤー責務

| レイヤー | 責務 | INV参照 | 理念 |
|---|---|---|---|
| Client Layer (Desktop) | デスクトップUI描画、ユーザー入力、WebSocket管理。**ビジネスロジックを含まない。** | INV-1 | P-1 |
| Client Layer (Web/PWA) | ブラウザベースUI。Desktop版と同一Reactアプリ。レスポンシブ対応。 | INV-1 | P-1 |
| Client Layer (Mobile) | **モバイルはPWA（Progressive Web App）として提供し、ネイティブアプリは作らない。** Web Clientのレスポンシブデザインで対応する。Tailscale経由でリモートの Core Daemon に接続。 | INV-1 | P-1 |
| Tauri Rust Shell | デスクトップ固有機能（Daemonライフサイクル、ポートスキャン、リモートアクセス）。Core Daemonとはプロセス依存のみ。 | INV-1 | P-1 |
| Core Daemon (Rust) | 全ビジネスロジック。UIなしで独立動作可能。PTY管理、エージェント制御、API提供、オーケストレーション。 | INV-1, INV-2 | P-1 |
| Persistence | SQLite + 設定ファイルによるデータ永続化。使用量・課金データ含む。 | INV-4 | P-2 |

## 3. プロセスモデル

### 3.1. デスクトップ版

```
[Desktop Launch]
      │
      ▼
  Tauri Process (Rust)
      │
      ├── spawn ──► Core Daemon (side-server start --port 8787)
      │                 │
      │                 ├── HTTP Server (:8787)
      │                 ├── WebSocket Server
      │                 ├── Orchestrator + Observer
      │                 └── PTY Processes (per terminal)
      │
      └── WebView ──► React Frontend (localhost:5173 / bundled)
```

### 3.2. Web版

```
[Browser Access]
      │
      ▼
  React Frontend (Vite dev server / static files)
      │ HTTP / WebSocket
      ▼
  Core Daemon (side-core serve, standalone)
      │
      ├── HTTP Server (:8787)
      ├── WebSocket Server
      ├── Orchestrator + Observer
      └── PTY Processes (per terminal)
```

### 3.3. モバイル版 (PWA)

```
[Mobile Browser / ホーム画面アプリ]
      │
      ▼
  React Frontend (PWA, Responsive)
      │ HTTP / WebSocket (Tailscale VPN経由)
      ▼
  Core Daemon (リモートマシン上で稼働)
```

**モバイル方針:** PWAを主、ネイティブアプリを補助として位置づける。
- PWA: Web Clientをレスポンシブ対応し、ホーム画面追加でアプリとして動作
- ネイティブ: `apps/mobile/` に React Native/Expo アプリを提供（一部機能限定）
リモートアクセスはTailscale経由（desktop.md §9参照）。

### 3.4. CLIモード

```
[ターミナルからの直接実行]
      │
      ▼
  side-core <subcommand>
      │
      ├── [Daemon稼働中] → localhost:PORT のAPIに委譲
      └── [Daemon非稼働] → 直接DB/設定にアクセスして応答
```

CLIコマンド体系の詳細は [server.md](./server.md) §2 を参照。

### 3.5. Headless-First保証 (INV-1)

Core DaemonはRust製のCLIバイナリとして単独起動可能:
- `side-core serve` — デーモンモード（HTTP/WSサーバー起動）
- `side-core status` — ステータス確認
- `side-core agent list` — エージェント管理
- `cargo run -- serve` — 開発

UIの有無にかかわらず、すべてのAPI/WebSocket/PTY管理/オーケストレーションが動作すること。
これが INV-1 の検証基準であり、P-1（決定論的オーケストレーション）の物理的保証である。

## 4. 通信プロトコル

| 通信経路 | プロトコル | 用途 |
|---|---|---|
| Client → Core Daemon | HTTP REST | CRUD操作、設定取得 |
| Client ↔ Core Daemon | WebSocket | ターミナルI/Oストリーミング |
| Agent → Core Daemon | MCP Tool (in-process) | PTY操作、ファイル操作（agents.md §2.2） |
| Agent ↔ Agent | MCP (via SIDEMCPServer) | エージェント間通信 (INV-3) |
| CLI → Core Daemon | HTTP (localhost) | CLIモードのAPI委譲 |
| Tauri → Core Daemon | HTTP (localhost) | Daemonステータス確認 |
| Tauri → Core Daemon | プロセスspawn | Daemonライフサイクル管理 |
| Mobile → Core Daemon | HTTP/WS (Tailscale VPN) | リモートアクセス |

## 5. セキュリティ境界

| 境界 | 制御 |
|---|---|
| ファイルシステムアクセス | ワークスペースルート以下に制約。パストラバーサル検証必須。 |
| ネットワーク | CORS制御 + 認証（本番必須）+ CSRF保護 |
| WebSocket | IP単位接続数制限 + 認証 + メッセージサイズ制限 |
| プロセス | PTYプロセスはCore Daemon管理下。強制終了可能 (INV-6)。 |
| エージェントPTY入力 | 危険コマンドフィルタ + タイムアウト（terminal-io.md §2.2） |
| リモートアクセス | Tailscale ACL + アプリ認証の二重化（desktop.md §9） |
