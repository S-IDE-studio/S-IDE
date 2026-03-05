# AGENTS.md — S-IDE エージェント命令系統

本ドキュメントは、S-IDEプロジェクトで複数のAIエージェントが並行して開発を行う際の
**役割定義、命令系統、品質ゲート**を定義する。

前提: [ARCHITECTURE.md](./ARCHITECTURE.md) の基本理念、不変条件、評価指標を理解していること。

---

## 1. ドキュメント読解プロトコル

S-IDEで作業を開始するエージェントは、以下の順序でドキュメントを読め。

```
Step 1: ARCHITECTURE.md を読む
        → 基本理念 (P-1, P-2) を理解する (§2)
        → 不変条件 (INV-1〜6) を理解する (§3)
        → 評価指標を記憶する (§4)
        → 判断フレームワークを内面化する (§5)

Step 2: 本ドキュメント (AGENTS.md) を読む
        → 自分の担当ドメインを確認する (§2)
        → 対応するspecファイルを特定する (§3)

Step 3: 担当ドメインのspecファイルのみを読む
        → docs/specs/ から必要なファイルだけを読む
        → 全specを読む必要はない

Step 4: 作業を開始する
        → 作業完了前に必ずQuality Gate (§4) を通過すること
```

> **重要:** 全ドキュメントを読むな。自分のタスクに必要なspecだけを読め。
> コンテキストの浪費は INV-5 (Context Economy) に違反する。

---

## 2. ドメイン分類と担当範囲

S-IDEの開発ドメインは以下の7領域に分類される。
各領域は独立して並行開発可能な境界を持つ。

| ドメイン | スコープ | 主要パス | Spec |
|---|---|---|---|
| **System** | レイヤー構造、プロセスモデル、境界定義 | プロジェクトルート | [system.md](./docs/specs/system.md) |
| **Core** | REST API、ミドルウェア、DB、設定管理 | Core Daemon | [server.md](./docs/specs/server.md) |
| **Frontend** | UIコンポーネント、状態管理、APIクライアント | Web Client | [frontend.md](./docs/specs/frontend.md) |
| **Desktop** | Tauri Shell、Daemonライフサイクル、リモート | Desktop Shell | [desktop.md](./docs/specs/desktop.md) |
| **Agents** | エージェントシステム、MCP、通信プロトコル | Core Daemon内エージェント層 | [agents.md](./docs/specs/agents.md) |
| **Terminal** | PTY管理、WebSocket、画面バッファ抽象化 | Core Daemon内PTY管理層 | [terminal-io.md](./docs/specs/terminal-io.md) |
| **Conventions** | 命名規則、テスト、ビルド、依存関係 | プロジェクト全体 | [conventions.md](./docs/specs/conventions.md) |

### 2.1. 境界ルール

- 1つのタスクが**複数ドメインにまたがる**場合は、まず分割できないか検討する
- 分割不可能な場合、**最も影響の大きいドメイン**のspecを主として、関連specを副として読む
- **型定義の変更**は必ず `conventions.md` のルールに従い、Core Daemon側のAPI型を起点とする

### 2.2. 依存方向（変更の波及パス）

```
Core Daemon API変更 → Web Client に波及
Web Client  変更 → Desktop Shell (WebViewバンドル) に波及
Desktop Shell 変更 → 波及なし（末端）
```

---

## 3. Spec Navigation（仕様ルーティング）

タスクの内容から、どのspecを読むかを判断するためのルーティングテーブル。

### 3.1. キーワードベースルーティング

| タスクに含まれるキーワード | 読むべきspec |
|---|---|
| API, ルート, エンドポイント, REST | `server.md` |
| ミドルウェア, 認証, CORS, セキュリティ | `server.md` |
| DB, SQLite, 永続化 | `server.md` |
| 設定, config, 環境変数 | `server.md` + `conventions.md` |
| コンポーネント, UI, 画面, パネル | `frontend.md` |
| React, hooks, Context, 状態管理 | `frontend.md` |
| Monaco, エディタ | `frontend.md` |
| Tauri, Rust, デスクトップ, インストーラ | `desktop.md` |
| サーバー起動, sidecar, プロセス管理 | `desktop.md` |
| Tailscale, トンネル, リモートアクセス | `desktop.md` |
| エージェント, MCP, ブリッジ, 通信 | `agents.md` |
| スキル, 共有リソース | `agents.md` |
| ターミナル, PTY, WebSocket, xterm | `terminal-io.md` |
| バッファ, 画面状態, リサイズ | `terminal-io.md` |
| テスト, ビルド, lint, 型, 命名 | `conventions.md` |
| ファイル構成, パッケージ, 依存関係 | `conventions.md` |

### 3.2. 複合タスクの分解例

```
タスク: 「新しいエージェント管理画面を追加する」

分解:
  1. エージェントの新しいAPIルートを追加 → server.md + agents.md
  2. UIコンポーネントを実装 → frontend.md
  3. 型定義を追加 → conventions.md

実行順序:
  Core Daemon (型定義+API) → Web Client (UI)
  ※ この順序はconventions.mdの依存方向ルールに基づく
```

---

## 4. Quality Gate（品質ゲート）

作業完了の**前**に、以下のチェックを実行せよ。
全項目がPassにならない限り、作業完了を宣言してはならない。

### 4.1. 不変条件チェック

| # | チェック項目 | Invariant | 理念 |
|---|---|---|---|
| Q-1 | 新しいビジネスロジックは Core Daemon に実装されているか？ | INV-1 | P-1 |
| Q-2 | Web Client にビジネスロジックが漏れていないか？ | INV-1 | P-1 |
| Q-3 | APIの入出力はモック可能で決定的か？ | INV-2 | P-1 |
| Q-4 | エージェント間通信はMCPServer経由か？ | INV-3 | P-1+P-2 |
| Q-5 | 環境依存値はconfig経由で解決されているか？ | INV-4 | P-2 |
| Q-6 | エージェントへのデータ提供は構造化・フィルタリングされているか？ | INV-5 | P-2 |
| Q-7 | 長時間実行処理に停止手段があるか？ | INV-6 | P-1 |

### 4.2. 技術チェック

| # | チェック項目 |
|---|---|
| T-1 | `bun run type-check` が通るか？ |
| T-2 | `bun run lint` がエラーなしか？ |
| T-3 | `bun run test` が全パスか？ |
| T-4 | `any` 型を使っていないか？（`unknown` + 型ガードを使え） |
| T-5 | すべての非同期処理に明示的エラーハンドリングがあるか？ |
| T-6 | ファイル操作にパストラバーサル検証があるか？ |

### 4.3. 評価スコア確認

ARCHITECTURE.md §4 の 5 つの評価指標について、
変更前後でスコアが下がっていないことを確認せよ。

```
□ Headless Independence Score (HIS) — 下がっていない  [P-1]
□ Context Efficiency Score (CES)    — 下がっていない  [P-2]
□ Contract Adherence Score (CAS)    — 下がっていない  [P-1+P-2]
□ Determinism Score (DS)            — 下がっていない  [P-1]
□ Interruptibility Score (IS)       — 下がっていない  [P-1]
```

---

## 5. コンフリクト解決

複数エージェントが並行作業する際の衝突を防ぐためのルール。

### 5.1. ファイル所有権

- 同一ファイルを複数エージェントが同時に編集してはならない
- ドメイン境界で分割し、各エージェントは自分のドメインのファイルのみを変更する
- Core Daemon側のAPI型を変更する場合は、変更を先に完了させ、他エージェントはその結果を受け取ってから作業を開始する

### 5.2. 依存型変更の波及

```
型定義の変更が必要な場合:

1. Core Daemon側のAPI型を変更するエージェントが先に作業完了する
2. 型変更の結果（新しい構造体、変更されたフィールド）を明示する
3. 依存先のエージェント（Web Client等）がそれに合わせて変更する
```

### 5.3. 意見が割れたときの優先順位

```
ARCHITECTURE.md の基本理念 (§2)           ← 最優先。P-1/P-2に反する案は却下
    ↓
ARCHITECTURE.md の不変条件 (§3)           ← 理念を具現化するルール。違反不可
    ↓
ARCHITECTURE.md の評価指標 (§4)           ← スコアが高い方を選ぶ
    ↓
担当ドメインのspec                        ← specに記載があるならそれに従う
    ↓
conventions.md                            ← 規約に記載があるならそれに従う
    ↓
エージェント自身の判断                     ← 上記すべてに該当しない場合のみ
```
