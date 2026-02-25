## 概要

`server.md` §6 で定義されているミドルウェアチェーンの一部が未実装であり、§8 のグレースフルシャットダウンも不完全である。

## ミドルウェアの問題

### ドキュメント定義 (server.md §6)
```
securityHeaders → cors → requestId → bodyLimit → rateLimit → auth → csrfProtection
```

### 実装状況

| ミドルウェア | 状態 |
|---|---|
| securityHeaders | 実装済み |
| cors | 実装済み |
| requestId | 実装済み |
| **bodyLimit** | **未実装** |
| **rateLimit** | **未実装** (ファイルは存在: `rate-limiter.ts` だが `server.ts` に適用なし) |
| auth | 実装済み |
| csrfProtection | 実装済み（特定ルートに適用） |

### 問題点
- `bodyLimit` が未適用 → `MAX_REQUEST_BODY_SIZE` (1MB) の制約が機能していない
- `rateLimit` ミドルウェアが `server.ts` のチェーンに組み込まれていない

## グレースフルシャットダウンの問題

### ドキュメント定義 (server.md §8)
1. 全エージェントプロセスに停止通知（Observer経由）
2. 全MCPサーバーにSIGTERM送信
3. 全ターミナルセッションのバッファをSQLiteに保存
4. 使用量レコードをフラッシュ
5. DB接続をクローズ
6. HTTPサーバーを停止

### 実装状況
- ステップ 3 のみ部分的に実装（`saveTerminalBuffersOnShutdown`）
- ステップ 1, 2, 4 は Observer/MCPサーバー管理が未実装のため不可能
- ステップ 5, 6 は基本的な実装あり

## 影響するINV

- **INV-6 (Observable & Interruptible, P-1):** シャットダウン中の外部からの強制停止保証が不十分
- **INV-2 (Deterministic Boundary):** bodyLimit未適用によりサーバーの振る舞いが予測不能

## 受け入れ基準

- [ ] bodyLimit ミドルウェアの適用
- [ ] rateLimit ミドルウェアのチェーンへの組み込み
- [ ] グレースフルシャットダウンの全ステップ実装
- [ ] シャットダウン中の強制停止対応

## 対象ファイル

- `apps/server/src/server.ts`
- `apps/server/src/middleware/rate-limiter.ts`
