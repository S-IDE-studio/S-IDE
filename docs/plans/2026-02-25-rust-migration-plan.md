# Rust移行計画 — Core DaemonのRust化

## 1. 意思決定フレームワーク適用

### Step 1: 理念への奉仕

| 理念 | 評価 | 理由 |
|------|------|------|
| **P-1: Deterministic Orchestration** | ⬆️ 向上 | Rustの型安全性・メモリ安全性により「決定論的環境」を強化。コンパイル時の厳格チェックがINV-2を支援 |
| **P-2: Integrated AI Agent Management** | → 維持 | 機能的には同等。開発速度は一時的に低下するが、長期的な保守性が向上 |

### Step 2: Invariants確認

| Invariant | 評価 | 対応 |
|-----------|------|------|
| INV-1: Headless-First | ✅ 維持 | RustでもCLIバイナリとして単独起動可能 |
| INV-2: Deterministic Boundary | ✅ 向上 | Rustの所有権システムが不変性を強制 |
| INV-3: MCP as Universal Contract | ✅ 維持 | MCP通信は言語に依存しない |
| INV-4: Config-as-Code | ✅ 維持 | 設定ファイル形式は変更なし |
| INV-5: Context Economy | ✅ 維持 | 構造化データ提供は実装で保証 |
| INV-6: Observable & Interruptible | ✅ 維持 | 監視・介入APIはRustでも実装可能 |

**判定:** 全Invariantを満たし、一部は向上

### Step 3: 評価指標への影響

| 指標 | 影響 | 理由 |
|------|------|------|
| HIS (Headless Independence) | → 維持 | Core Daemon単体で動作する設計は維持 |
| CES (Context Efficiency) | → 維持 | 構造化データ提供は言語に依存しない |
| CAS (Contract Adherence) | → 維持 | MCP経由通信は維持 |
| DS (Determinism Score) | ⬆️ 向上 | Rustの型システム・所有権により決定性が強化 |
| IS (Interruptibility Score) | → 維持 | 強制停止APIはRustでも実装可能 |

### Step 4-6: スコープと影響範囲

```
変更対象:
├── Core Daemon (apps/server/) → 完全書き換え (TypeScript → Rust)
├── Web Client (apps/web/) → 変更なし (API互換性維持)
├── Desktop Shell (apps/desktop/) → 最小変更 (バイナリ名変更のみ)
└── ドキュメント → Rust実装に合わせて修正
```

## 2. 移行戦略: 段階的並行運用

### フェーズ0: 準備（1-2週間）
- [ ] Rustプロジェクト構造作成
- [ ] CI/CDパイプライン更新
- [ ] 技術選定最終決定

### フェーズ1: 基盤構築（2-3週間）
- [ ] HTTPサーバー基盤（axum）
- [ ] 設定管理（INV-4）
- [ ] ロギング・ミドルウェア

### フェーズ2: コア機能（3-4週間）
- [ ] SQLite接続・マイグレーション
- [ ] ワークスペース管理API
- [ ] Deck管理API

### フェーズ3: ターミナル機能（3-4週間）
- [ ] PTY管理（portable-pty相当）
- [ ] WebSocket実装
- [ ] Screen Buffer（VT100パーサー）

### フェーズ4: エージェント機能（3-4週間）
- [ ] MCPサーバー実装
- [ ] Orchestrator・Observer
- [ ] エージェント管理API

### フェーズ5: 統合・移行（2-3週間）
- [ ] 統合テスト
- [ ] パフォーマンス検証
- [ ] TypeScript版 deprecation

**合計工数:** 約3-4ヶ月（フルタイム換算）

## 3. 技術選定

| 領域 | TypeScript (現状) | Rust (目標) | 理由 |
|------|-------------------|-------------|------|
| HTTP Framework | Hono | axum | エコシステム・型安全性 |
| Async Runtime | Node.js | tokio | 標準的な非同期ランタイム |
| Database | better-sqlite3 | sqlx + rusqlite | 型安全なSQL |
| PTY | node-pty | portable-pty (Rust版) | クロスプラットフォーム |
| CLI | commander | clap | 強力なマクロ・型安全 |
| Serialization | zod | serde | 標準的なシリアライズ |
| Config | 独自実装 | toml + serde | 型安全な設定 |

## 4. 互換性維持戦略

### API仕様
- REST APIエンドポイント: 完全互換
- WebSocketプロトコル: 完全互換
- 設定ファイル形式: 完全互換
- データベーススキーマ: 完全互換

### 段階的切り替え
```
1. Rust版開発 → apps/server-rust/ で並行開発
2. Feature flagで切り替え可能に
3. テスト環境でRust版を検証
4. 本番環境で段階的にロールアウト
5. TypeScript版をdeprecated → 削除
```

## 5. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| 開発期間の長期化 | 高 | MVP機能から優先的に実装 |
| バグ混入 | 中 | 包括的なテスト・並行運用期間 |
| パフォーマンス劣化 | 低 | 早期にベンチマーク実施 |
| 学習コスト | 中 | ドキュメント整備・ペアプロ |

## 6. 即座に開始可能なタスク

### タスク1: Rustプロジェクト構造作成
```
apps/
├── server/           # 現状のTypeScript (最終的に削除)
├── server-rust/      # 新規Rustプロジェクト
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── config.rs
│   │   ├── server.rs
│   │   ├── routes/
│   │   ├── agents/
│   │   ├── terminal/
│   │   └── utils/
│   └── tests/
```

### タスク2: 最小限のHTTPサーバー実装
- axumベース
- `/health` エンドポイントのみ
- TypeScript版と同じポートで起動確認

### タスク3: 設定管理実装
- toml設定ファイル読み込み
- 環境変数オーバーライド
- TypeScript版と同等の設定項目

---

**次のアクション:**
1. この計画のレビュー・承認
2. フェーズ0（準備）の開始
3. 並行してTypeScript版の機能凍結（新機能追加停止）
