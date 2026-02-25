## 概要

`terminal-io.md` §3 で定義されている **Screen Buffer Abstraction** レイヤーが実装されていない。現在のターミナル実装は生バッファのみで、エージェント向けの構造化されたデータ提供手段がない。

## ドキュメントの要求 (terminal-io.md §3)

### Screen Buffer データ構造
- `screen`: `char[rows][cols]` — 現在の画面状態
- `cursor`: `{ row, col }` — カーソル位置
- `scrollback`: `string[]` — スクロールバック
- `diff`: `Change[]` — 前回取得からの差分
- `metadata.cwd`: 現在のワーキングディレクトリ
- `metadata.process`: フォアグラウンドプロセス名
- `metadata.exitCode`: 最後の終了コード

### 未実装の MCP Tools
- `terminal_read_screen` — 画面状態取得
- `terminal_read_diff` — 差分取得
- `terminal_read_summary` — 要約テキスト取得
- `terminal_write` — コマンド送信（安全性チェック付き）
- `terminal_create` / `terminal_destroy` / `terminal_list`

### VT100 Parser
- VT100エスケープシーケンス解釈
- 仮想画面の維持
- diff計算

## 影響するINV

- **INV-5 (Context Economy, P-2):** エージェントに構造化データを提供できないため、生ストリームが流れ続ける
- **INV-6 (Observable & Interruptible, P-1):** Screen Buffer 経由での異常パターン検知ができない

## 受け入れ基準

- [ ] VT100パーサーの実装
- [ ] Screen Buffer データ構造の実装
- [ ] MCP Tool (`terminal_read_screen`, `terminal_read_diff`, `terminal_read_summary`) の実装
- [ ] エージェント入力の安全性チェック（危険コマンドフィルタ）
- [ ] WebSocketには生ストリーム、Agent APIには構造化データを分岐出力

## 対象ファイル

- `apps/server/src/` (新規モジュール作成)
- `apps/server/src/websocket.ts` (出力分岐の統合)
