# conventions.md — 命名規則・テスト・ビルド・依存関係

上位ドキュメント: [ARCHITECTURE.md](../../ARCHITECTURE.md)

---

## 1. ファイル命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| Rustモジュール (Core Daemon) | snake_case | `agent_bridge.rs` |
| Rustテスト (Core Daemon) | 対象名 + `_tests` | `commands_tests.rs` |
| コンポーネント (Web Client) | PascalCase | `TerminalPane.tsx` |
| フック (Web Client) | camelCase (`use` prefix) | `useTerminal.ts` |
| ユーティリティ | camelCase (TS) / snake_case (Rust) | `resizeFlapGuard.ts` / `trap_guard.rs` |
| テストファイル (TS) | 対象名 + `.test` | `agents.test.ts` |
| 型定義 | `types.ts` / `types.rs` | `agents/types.ts` |
| 設定ファイル | `config.ts` / `config.rs` | `config.rs` |

## 2. 型安全ルール

- **`any` 型の使用禁止（TypeScript）。** `unknown` + 型ガードを使う
- **`unsafe` の最小化（Rust）。** 使用する場合は `// SAFETY:` コメント必須
- Core Daemonの公開API型はRust側で定義し、必要に応じてTS側に対応型を維持する

### 2.1 型定義の変更手順

```
1. Core Daemon側のAPI型を変更
2. 対応するWeb Client側の型を更新
3. 型チェックで全体の整合性を確認
```

## 3. 依存関係ルール

### 3.1. 許可される依存方向

```
Core Daemon API  ←── Web Client (HTTP/WebSocket経由のみ)

Web Client       ←── Desktop Shell (WebViewバンドル)

Core Daemon      ←── Desktop Shell (プロセス依存のみ、コード依存なし)
```

### 3.2. 禁止される依存

| 禁止 | 理由 |
|---|---|
| Web Client → Core Daemon (直接import) | INV-1違反（P-1）。HTTP/WS経由でのみ通信。 |
| Core Daemon → Web Client | バックエンドはUIに依存してはならない（INV-1, P-1） |
| Desktop Shell → Core Daemon (コード依存) | プロセス管理のみ許可。直接importは禁止。 |

## 4. コード生成手順

新しい機能を実装する際の順序:

```
1. Core Daemon側のAPI型・構造体を定義

2. Core Daemonにビジネスロジックを実装
   ├── APIルート（ハンドラ）
   └── ユーティリティ

3. Web Client側のAPIクライアント更新
   └── api.ts

4. UIコンポーネント
   ├── components/
   └── hooks/

5. テスト
   ├── Core Daemon: Rustユニットテスト + 統合テスト
   └── Web Client: Vitest
```

## 5. テスト規約

| 項目 | 規則 |
|---|---|
| Rustテスト | `#[cfg(test)]` モジュール or `_tests.rs` サフィックス |
| TSテスト | Vitest + happy-dom |
| テスト配置 | `__tests__/` ディレクトリ (TS) / インライン (Rust) |
| カバレッジ | `cargo test` + `bun run test:coverage` |
| CI | lint → type-check → test → build |

### 5.1. テスト名の規則

**Rust:**
```rust
#[test]
fn should_return_error_when_invalid_input() {
    // ...
}
```

**TypeScript:**
```typescript
describe("対象モジュール名", () => {
  it("should [期待される振る舞い] when [条件]", () => {
    // ...
  });
});
```

## 6. エラーハンドリング

- すべての非同期処理に明示的なエラーハンドリングを実装する
- **Rust:** `Result<T, E>` を使用。`unwrap()` は本番コード禁止
- **TypeScript:** `catch` なしの `try` ブロック禁止
- `Promise` のfire-and-forget禁止（INV-6違反のリスク, P-1）
- エラーレスポンスは構造化されたJSONで返す:

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## 7. パストラバーサル防御

ファイルシステム操作を行うすべてのルートは:

1. パスバリデーションモジュールを使用
2. ワークスペースルートからの相対パスに正規化
3. `..` やシンボリックリンクによるルート外アクセスを拒否

## 8. コミットメッセージ

```
<type>(<scope>): <description>

type: feat | fix | refactor | docs | test | chore | perf
scope: core | web | desktop | agents | mcp | terminal
```

## 9. ビルドコマンド

| コマンド | 動作 |
|---|---|
| `bun run dev` | Web開発サーバー (Vite :5173) |
| `cargo run` | Core Daemon開発起動 |
| `bun run dev:desktop` | デスクトップ開発 (Tauri + Vite) |
| `bun run build` | 全コンポーネントビルド |
| `bun run build:desktop` | デスクトップビルド (web → Core Daemon → Tauri) |
| `bun run type-check` | TypeScript型チェック |
| `bun run lint` | Biome lint (TS) + clippy (Rust) |
| `bun run lint:fix` | Biome自動修正 |
| `bun run test` | 全テスト実行 |
| `bun run ci` | CI (lint → type-check → test → build) |
