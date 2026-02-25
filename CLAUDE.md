# CLAUDE.md

Claude Code がこのリポジトリで作業する際のエントリポイント。

## 作業開始前に読むもの

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — 基本理念(P-1/P-2)、不変条件、評価指標を理解する
2. **[AGENTS.md](./AGENTS.md)** — 自分の担当ドメインとQuality Gateを確認する
3. **担当ドメインのspec** — `docs/specs/` から必要なファイルのみ読む

> 全specを読む必要はない。タスクに関連するドキュメントだけを読め。
> → ルーティングテーブルは [AGENTS.md §3](./AGENTS.md#3-spec-navigation仕様ルーティング) を参照。

## プロジェクト概要

**S-IDE** — AIエージェントのオーケストレーションと統合管理を行うインフラストラクチャ。
Rust Core Daemon + React Web Client + Tauri Desktop Shell の3層構成。

```
Core Daemon   # Rust製ヘッドレスバックエンド（全ビジネスロジック）
Web Client    # React 18 + Vite フロントエンド（薄いUI）
Desktop Shell # Tauri 2.0 デスクトップアプリ（Daemon管理+デスクトップ固有）
```

## 必須コマンド

```bash
# 開発
pnpm run dev                # Web開発サーバー
pnpm run dev:server         # サーバー開発モード (tsx watch)
pnpm run dev:desktop        # デスクトップ開発 (Tauri + Vite)

# 品質チェック（Quality Gate T-1〜T-3）
pnpm run type-check         # 型チェック
pnpm run lint               # Biome lint
pnpm run test               # テスト実行

# ビルド
pnpm run build              # web + server + desktop
pnpm run build:desktop      # デスクトップビルド（全コンポーネント含む）

# 修正
pnpm run lint:fix           # Biome自動修正
pnpm run format             # フォーマット
```

## 作業完了前のチェックリスト

作業完了を宣言する前に、必ず [AGENTS.md §4 Quality Gate](./AGENTS.md#4-quality-gate品質ゲート) を通過すること。

```
□ pnpm run type-check が通る
□ pnpm run lint がエラーなし
□ pnpm run test が全パス
□ ARCHITECTURE.md の基本理念(P-1/P-2)・不変条件に違反していない
□ 評価スコアが下がっていない（P-1関連は特に注意）
```

## 重要な注意事項

- **any 型禁止**。`unknown` + 型ガードを使う。
- **ファイル操作** は必ずパストラバーサル検証を含めること。
- **ビジネスロジック** は Core Daemon に書く。Web Client は表示のみ。
- **P-1 > P-2**。安全・制御に関わるルールは効率・管理に関わるルールより常に優先される。

## 詳細仕様への導線

| 何を知りたいか | 読むファイル |
|---|---|
| システム全体の構造 | [docs/specs/system.md](./docs/specs/system.md) |
| Core Daemon の API・DB・設定 | [docs/specs/server.md](./docs/specs/server.md) |
| UIコンポーネント・状態管理 | [docs/specs/frontend.md](./docs/specs/frontend.md) |
| Tauri/Rust・Daemonライフサイクル | [docs/specs/desktop.md](./docs/specs/desktop.md) |
| エージェント・MCP | [docs/specs/agents.md](./docs/specs/agents.md) |
| ターミナル・PTY・WebSocket | [docs/specs/terminal-io.md](./docs/specs/terminal-io.md) |
| 命名規則・テスト・ビルド | [docs/specs/conventions.md](./docs/specs/conventions.md) |
