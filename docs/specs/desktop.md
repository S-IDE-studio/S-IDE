# desktop.md — Tauri/Rust Shell 仕様

上位ドキュメント: [ARCHITECTURE.md](../../ARCHITECTURE.md) > [system.md](./system.md)

---

## 1. 概要

Desktop ShellはTauri 2.0ベースのデスクトップアプリケーション。
Core Daemon（Rust CLIバイナリ）のプロセスライフサイクル管理とデスクトップ固有機能を提供する。

**重要:** ビジネスロジックはここに実装しない（INV-1, P-1）。
Desktop ShellはCore Daemonの起動・停止・監視のみを行う。

**技術スタック:** Rust (2021 edition), Tauri 2.0, tokio, serde, sysinfo, reqwest

## 2. モジュール構成

| ファイル | 責務 |
|---|---|
| `main.rs` | エントリポイント。Tauri Builder、プラグイン登録、コマンド登録 |
| `server.rs` | Core Daemonのライフサイクル管理。`DaemonHandle` 型 |
| `commands.rs` | Tauriコマンド群（`#[tauri::command]`デコレータ） |
| `scanner.rs` | ローカルネットワークスキャン（ポート、nmap） |
| `tailscale.rs` | Tailscaleステータスチェック |
| `remote_access.rs` | リモートアクセス設定・HTTPS管理 |
| `tunnel.rs` | ローカルトンネル管理。`TunnelHandle` 型 |
| `window.rs` | ウィンドウ設定（カスタムタイトルバー、デコレーションなし） |
| `common.rs` | 共通ユーティリティ |

## 3. 状態管理

Tauriの `manage()` APIによるグローバル状態:

```rust
type DaemonStateInner = TokioMutex<Option<server::DaemonHandle>>;
type TunnelStateInner = TokioMutex<Option<tunnel::TunnelHandle>>;

struct DaemonState(DaemonStateInner);
struct TunnelState(TunnelStateInner);
```

**パターン:** `TokioMutex<Option<Handle>>` で存在/非存在を表現。

## 4. Tauriコマンド一覧

| コマンド | カテゴリ |
|---|---|
| `start_daemon` | Daemon管理 |
| `stop_daemon` | Daemon管理 |
| `get_daemon_status` | Daemon管理 |
| `get_daemon_logs` | Daemon管理 |
| `start_tunnel` | トンネル |
| `stop_tunnel` | トンネル |
| `get_tunnel_status` | トンネル |
| `get_tailscale_status` | リモート |
| `get_remote_access_status` | リモート |
| `get_remote_access_settings` | リモート |
| `set_remote_access_settings` | リモート |
| `start_remote_access_https` | リモート |
| `stop_remote_access` | リモート |
| `check_environment` | 環境 |
| `check_port` | 環境 |
| `scan_local_servers` | スキャン |
| `get_mcp_servers` | MCP |
| `scan_local_servers_advanced` | スキャン |
| `check_nmap_available` | スキャン |

## 5. Daemonライフサイクル

```
Tauri app launch
    │
    ▼
window::setup(app)
    │ Daemon起動タスクをspawn
    ▼
commands::start_daemon
    │ server::DaemonHandle 生成
    │ Core Daemon子プロセスを起動 (Rust CLIバイナリ)
    ▼
DaemonState = Some(handle)
    │
    ├── [ヘルスチェック] ──► HTTP GET localhost:8787/api/health
    │
    ├── [停止要求] ──► commands::stop_daemon
    │                     │ handle.kill()
    │                     ▼ DaemonState = None
    │
    └── [Tauriプロセス終了] ──► 子プロセスの自動クリーンアップ
```

**INV-6 (P-1) 準拠:** DaemonHandleは常に外部から`kill()`可能。
ヘルスチェックが失敗した場合、自動再起動またはユーザー通知を行う。

## 6. Tauriプラグイン

| プラグイン | 用途 |
|---|---|
| `tauri-plugin-shell` | シェルコマンド実行 |
| `tauri-plugin-dialog` | ネイティブダイアログ |
| `tauri-plugin-updater` | 自動更新（GitHub Releases） |

## 7. バンドル設定

`tauri.conf.json` の主要設定:

| 設定 | 値 |
|---|---|
| `productName` | S-IDE |
| `identifier` | com.side.ide |
| `frontendDist` | Web Client ビルド成果物 |
| `devUrl` | `http://localhost:5173` |
| `bundle.targets` | msi, nsis, dmg, app, deb, appimage |
| `bundle.resources` | Core Daemonバイナリ + リソース |
| `updater.endpoints` | GitHub Releases |
| 窓装飾 | なし（`decorations: false`、カスタムタイトルバー） |

## 8. ビルドチェーン

```
bun run build:desktop
    │
    ├── 1. bun run build:web          (Vite → Web Client dist/)
    ├── 2. cargo build --release       (Core Daemon → バイナリ)
    └── 3. cargo tauri build           (Rust → インストーラ)
```

## 9. リモートアクセスセキュリティモデル

### 9.1. セキュリティ層

Tailscale経由のリモートアクセスは2層のセキュリティで保護する:

```
[Mobile / Remote Client]
      │
      ▼
┌─────────────────────────────────┐
│  Layer 1: Tailscale ACL         │
│  ・Tailscaleのアクセス制御で     │
│    接続可能なデバイスを制限      │
│  ・Tailscaleの暗号化通信(WireGuard)│
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  Layer 2: アプリケーション認証   │
│  ・AUTH_USER + AUTH_PASSWORD     │
│  ・(server.md §4 の設定チェーン) │
│  ・HTTPS強制 (remote_access.rs) │
└─────────────┬───────────────────┘
              │
              ▼
  Core Daemon (HTTP/WS Server)
```

### 9.2. リモートアクセス有効化フロー

```
1. Tailscaleがインストール済みかチェック (get_tailscale_status)
2. Tailscaleにログイン済みかチェック
3. S-IDEのリモートアクセスHTTPSを起動 (start_remote_access_https)
4. Tailscale ACLで許可されたデバイスのみ接続可能
5. 接続時にアプリケーション認証を要求
```

### 9.3. WebSocket再接続戦略

リモート環境ではネットワーク不安定性が想定されるため:

| イベント | 対応 |
|---|---|
| WebSocket切断 | 指数バックオフで自動再接続（1s → 2s → 4s → ... → 30s上限） |
| 再接続成功 | ターミナルバッファをSQLiteから復元 + 差分同期 |
| 再接続失敗（上限到達） | ユーザーに通知 + 手動再接続ボタン表示 |
| Tailscale VPN切断 | WebSocket切断と同様の再接続フローを適用 |
