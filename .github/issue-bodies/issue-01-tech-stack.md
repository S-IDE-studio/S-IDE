## 概要

ARCHITECTURE.md および docs/specs/ 配下の複数ドキュメントで、Core Daemon の技術スタックが **Rust** と記述されているが、実際の実装は **TypeScript (Hono + Node.js)** である。

## 矛盾箇所

| ドキュメント | 記述 | 実態 |
|---|---|---|
| `ARCHITECTURE.md` §5 Step 4 | `Core Daemon (Rust)` | TypeScript/Hono (`apps/server/`) |
| `system.md` §1 | `Core Daemon Layer (Headless / Rust)` | TypeScript |
| `system.md` §3.5 | `Rust製のCLIバイナリとして単独起動可能` | Node.js/TSX |
| `server.md` §1 | `Rust製ヘッドレスバックエンド` | TypeScript |
| `server.md` §1 | `技術スタック: Rust, tokio, SQLite, portable-pty, clap` | TypeScript, Hono, better-sqlite3, node-pty, commander |
| `server.md` §2 | `clap ベースのCLI` | `commander` ベースのCLI |
| `conventions.md` §1 | `Rustモジュール (Core Daemon) → snake_case` | TypeScript モジュール |
| `conventions.md` §5 | `cargo test` | `vitest` |

## 影響するINV

- **INV-2 (Deterministic Boundary):** ドキュメントに基づいた判断が誤る
- **INV-4 (Config-as-Code):** 設定チェーンの実装詳細が異なる

## 提案

以下のいずれかを実施:

1. **ドキュメントを実態に合わせて修正** — 現在の TypeScript/Hono 実装を正とし、全ドキュメントを更新
2. **実装を Rust に移行** — ドキュメントの理想に合わせて Rust 化（大規模リファクタ）

> **重要:** どちらの方針を採るか、プロジェクトオーナーの判断が必要です。

## 対象ファイル

- `ARCHITECTURE.md`
- `docs/specs/system.md`
- `docs/specs/server.md`
- `docs/specs/conventions.md`
- `AGENTS.md` / `CLAUDE.md`
