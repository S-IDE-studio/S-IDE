## 概要

`agents.md` §5 で定義されているコスト監視・使用量追跡のデータモデルが全く実装されていない。`UsageRecord`, `ProviderPricing`, `AgentSubscription` のいずれもコードベースに存在しない。

## ドキュメントの要求 (agents.md §5)

### 未実装データモデル

#### UsageRecord (§5.1)
エージェント実行ごとの使用量を記録:
- `id`, `agentId`, `sessionId`, `timestamp`
- `inputTokens`, `outputTokens`, `cost`, `duration`
- `model`, `taskId`

#### ProviderPricing (§5.2)
AIプロバイダのトークン単価管理:
- `providerId`, `model`
- `inputTokenCostPer1M`, `outputTokenCostPer1M`
- `updatedAt`

#### AgentSubscription (§5.3)
APIキー・サブスクリプション状態管理:
- `agentId`, `providerId`, `apiKey` (暗号化)
- `tier`, `expiresAt`, `remainingCredits`
- `lastCheckedAt`, `status`

### 未実装の監視機能

| 監視対象 | 閾値 | アクション |
|---|---|---|
| トークン使用量 | セッション/日次上限 | 警告→強制停止 |
| API呼び出し回数 | 分/時間あたり上限 | スロットリング→遮断 |
| 実行時間 | タスクあたり上限 | タイムアウト→強制停止 |
| 累計コスト | 日次/月次予算上限 | 警告→全エージェント停止 |
| APIキー有効性 | 有効期限切れ | エージェント無効化+通知 |

### 未実装のAPIルート
- `/api/agents/:id/usage` — 使用量・コスト情報
- `/api/agents/:id/subscription` — サブスクリプション状態

## 影響するINV

- **INV-6 (Observable & Interruptible, P-1):** コスト暴走を検知・停止できない
- **P-2 (Integrated AI Agent Management):** エージェントのコスト・パフォーマンスが定量的に計測できない

## 受け入れ基準

- [ ] SQLiteに `UsageRecord`, `ProviderPricing`, `AgentSubscription` テーブル作成
- [ ] 使用量記録の自動保存
- [ ] コスト計算ロジックの実装
- [ ] 閾値監視と介入（Observer連携）
- [ ] APIキー有効性チェック（起動時 + 定期実行）
- [ ] `/api/agents/:id/usage` エンドポイント
- [ ] `/api/agents/:id/subscription` エンドポイント

## 対象ファイル

- `apps/server/src/utils/database.ts` (マイグレーション追加)
- `apps/server/src/agents/` (新規モジュール)
- `apps/server/src/routes/agents.ts` (ルート追加)
