# terminal-io.md — PTY管理・WebSocket・コンテキスト抽象化 仕様

上位ドキュメント: [ARCHITECTURE.md](../../ARCHITECTURE.md) > [system.md](./system.md)

---

## 1. 概要

ターミナルI/OはS-IDEの根幹機能であり、2つのINVが交差する最重要領域。

| INV | 名称 | 理念 | ターミナルI/Oでの意味 |
|---|---|---|---|
| INV-5 | Context Economy | P-2 | エージェントへの情報を構造化し、コンテキスト消費を最小化する |
| INV-6 | Observable & Interruptible | P-1 | エージェントの操作を常時監視し、いつでも遮断できる |

**P-1 > P-2:** 可観測性（INV-6）がコンテキスト効率（INV-5）より常に優先される。
エージェントの暴走検知に必要なデータは、コンテキスト効率を犠牲にしてでも保持する。

---

## 2. データフロー

### 2.1. 人間の操作（WebSocket経由）

```
User Input (xterm.js)
    │
    ▼
WebSocket Client (Web Client)
    │ UTF-8 string
    ▼
WebSocket Server (Core Daemon)
    │ セキュリティ検証:
    │   1. IP接続数チェック
    │   2. WebSocket認証
    │   3. メッセージサイズ上限
    │
    ├── [通常入力] ──► session.term.write(message) ──► PTY Process
    │
    └── [リサイズ] ──► resize command
                           │ validateTerminalSize (1-500)
                           │ resizeFlapGuard
                           ▼
                      session.term.resize(cols, rows)
```

### 2.2. エージェントの操作（MCP Tool経由）

```
Worker Agent
    │
    ▼
MCP Tool: terminal_write(sessionId, command)
    │
    ▼
SIDEMCPServer (Core Daemon内)
    │ ① Observer に操作を記録 (INV-6)
    │ ② コマンドの安全性チェック（危険コマンドフィルタ）
    │ ③ PTYプロセスに書き込み
    ▼
session.term.write(command + "\n")
    │
    ▼
PTY Process
    │
    ├── stdout/stderr → Screen Buffer → 2つの出力:
    │     ├── WebSocket → xterm.js（人間用、生ストリーム）
    │     └── Agent API → 構造化データ（INV-5準拠）
    │
    └── Observer が出力を監視 → 異常パターン検知 (INV-6)
```

**エージェント入力の安全性チェック:**

| カテゴリ | 例 | 制御 |
|---|---|---|
| 危険コマンド | `rm -rf /`, `mkfs`, `dd` | ブロック + Observer通知 |
| 権限昇格 | `sudo`, `su` | 設定で許可/拒否（デフォルト拒否） |
| ネットワーク | `curl`, `wget` | 許可リストベースのフィルタ |
| 長時間実行 | 無限ループ等 | タイムアウト（設定可能） |

### 2.3. 出力フロー（共通）

```
PTY Process
    │ stdout/stderr
    ▼
session.onData callback (Core Daemon)
    │
    ├── ① buffer蓄積 (TERMINAL_BUFFER_LIMIT chars)
    │     └── SQLiteに永続化（セッション復元用）
    │
    ├── ② Screen Buffer 更新（§3参照）
    │     ├── VT100エスケープシーケンス解釈
    │     ├── 画面状態の更新（screen, cursor, scrollback）
    │     └── diff の計算
    │
    ├── ③ Observer に出力を通知（INV-6監視用）
    │
    └── ④ broadcast to all connected sockets（人間用）
          │
          ▼
     xterm.js render
```

---

## 3. Screen Buffer Abstraction

### 3.1. 設計

PTY出力を構造化する中間層。エージェントに対して生ストリームではなく画面状態を提供する（INV-5）。

```
[PTY生出力]
    │ VT100 escape sequences + UTF-8
    ▼
[VT100 Parser]
    │ エスケープシーケンス解釈
    │ 文字・カーソル移動・画面制御に分解
    ▼
[Screen Buffer]
    │ 仮想画面を保持（char[rows][cols]）
    │ カーソル位置を追跡
    │ スクロールバックを管理
    │ 前回からのdiffを計算
    ▼
[出力分岐]
    ├── Agent API ──► 構造化データ（INV-5）
    └── WebSocket ──► 生ストリーム転送（従来通り）
```

### 3.2. Screen Buffer のデータ構造

| フィールド | 型 | 説明 |
|---|---|---|
| `screen` | `char[rows][cols]` | 現在の画面状態 (デフォルト 24×80) |
| `cursor` | `{ row, col }` | カーソル位置 |
| `scrollback` | `string[]` | スクロールバック（要約可能） |
| `diff` | `Change[]` | 前回取得からの差分 |
| `metadata.cwd` | `string` | 現在のワーキングディレクトリ |
| `metadata.process` | `string` | フォアグラウンドプロセス名 |
| `metadata.exitCode` | `int?` | 最後に終了したコマンドの終了コード |

### 3.3. MCP Tools（エージェント向けAPI）

agents.md §2.2.1 で定義されたMCP Toolsの、ターミナルI/O側の実装詳細。

| Tool | 応答内容 | コンテキストコスト |
|---|---|---|
| `terminal_read_screen` | screen + cursor + metadata | 中（画面全体） |
| `terminal_read_diff` | 前回からの差分のみ | 低（差分のみ） |
| `terminal_read_summary` | 画面の自然言語要約 | 最低（1-2文） |
| `terminal_write` | コマンド送信 + 結果待機 | なし（入力のみ） |

**推奨パターン:**
```
1. 初回: terminal_read_screen で全体を把握
2. 以降: terminal_read_diff で差分のみ取得
3. 長時間経過後: terminal_read_summary で要約取得 → 必要なら screen に戻る
```

### 3.4. INV-6保護データ（Screen Buffer切り捨て対象外）

コンテキスト効率（INV-5）のためにdiffや要約を使用する場合でも、以下のデータはObserverに常に保持される:

| データ | 理由 |
|---|---|
| stderr出力 | エラー検知に必須 |
| 非ゼロ終了コード | 失敗検知に必須 |
| 異常パターン（無限ループ的出力等） | 暴走検知に必須 |
| ネットワーク関連出力 | セキュリティ監視に必須 |

---

## 4. セキュリティ制御

| 制御 | 値 | 設定可能 |
|---|---|---|
| IP単位最大接続数 | 1000 | 設定チェーン |
| 最大メッセージサイズ | 64KB | 設定チェーン |
| ターミナルサイズ範囲 | 1-500 (cols/rows) | 定数 |
| バッファ上限 | 50000 chars | `TERMINAL_BUFFER_LIMIT` |
| エージェント危険コマンド | 拒否リスト | 設定ファイル |
| エージェントコマンドタイムアウト | 300秒 | 設定チェーン |

---

## 5. 接続管理

```
// IP単位で接続を追跡
connectionsByIP: Map<string, Set<WebSocket>>

// 各ターミナルセッション
session = {
  id: string,
  term: PTY Process,         // PTYプロセス
  sockets: Set<WebSocket>,   // 接続中のクライアント
  buffer: string,            // 生バッファ
  screenBuffer: ScreenBuffer, // 構造化画面状態
  lastActive: timestamp,     // 最終活動タイムスタンプ
}
```

---

## 6. Context Manager との連携

Context ManagerはターミナルセッションのINV-6（可観測性）を支援する:

| 機能 | 説明 | 関連INV |
|---|---|---|
| Health Score (0-100) | メッセージ密度、ドリフト、エラー率から算出 | INV-6 (P-1) |
| Topic Drift Detection | 初期プロンプトと最近のメッセージの乖離度 | INV-6 (P-1) |
| Session Compaction | 古いメッセージの要約化（トークン40-60%削減） | INV-5 (P-2) |
| Snapshot/Restore | 会話状態の保存と復元 | INV-4 (P-2) |
| Auto-Compaction | ヘルススコア閾値以下で自動実行 | INV-5 (P-2) |
| Phase Detection | planning/implementation/debugging/reviewの識別 | INV-5 (P-2) |

---

## 7. 変更時のチェックリスト

- WebSocket認証は必ず維持する（セキュリティ境界）
- バッファ上限を超えたデータは切り捨てる（メモリ保護）
- リサイズ時は resizeFlapGuard を通す（UI安定性）
- セッション終了時にバッファをSQLiteに保存する（復元性）
- **INV-6:** stderr・異常パターンはバッファ切り捨て対象外（可観測性保護）
- **INV-5:** エージェント向けAPIは構造化データを返す（コンテキスト経済性）
- **新規:** エージェント入力は安全性チェックを通す（§2.2）
