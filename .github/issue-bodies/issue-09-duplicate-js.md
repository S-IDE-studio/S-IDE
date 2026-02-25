## 概要

`apps/server/src/` 配下に、同名の `.js` ファイルと `.ts` ファイルが21ペア共存している。TypeScriptへの移行が完了しているにもかかわらず、旧 `.js` ファイルが残存しており、混乱の原因となっている。

## 重複ファイル一覧

```
config.js         ↔ config.ts
index.js          ↔ index.ts
server.js         ↔ server.ts
types.js          ↔ types.ts
websocket.js      ↔ websocket.ts
middleware/auth.js     ↔ middleware/auth.ts
middleware/cors.js     ↔ middleware/cors.ts
middleware/security.js ↔ middleware/security.ts
routes/context-manager.js ↔ routes/context-manager.ts
routes/decks.js            ↔ routes/decks.ts
routes/files.js            ↔ routes/files.ts
routes/git.js              ↔ routes/git.ts
routes/settings.js         ↔ routes/settings.ts
routes/terminals.js        ↔ routes/terminals.ts
routes/workspaces.js       ↔ routes/workspaces.ts
utils/database.js     ↔ utils/database.ts
utils/error.js        ↔ utils/error.ts
utils/path.js         ↔ utils/path.ts
utils/resizeFlapGuard.js ↔ utils/resizeFlapGuard.ts
utils/shell.js        ↔ utils/shell.ts
utils/terminal-cwd.js ↔ utils/terminal-cwd.ts
```

**合計: 21ファイルの重複**

## 影響

- **INV-2 (Deterministic Boundary):** どちらのファイルが実際に実行されるか不明確 → 非決定的な振る舞いのリスク
- **開発効率:** エージェントや開発者がどちらを編集すべきか判断に迷う
- **conventions.md 違反:** TypeScript移行後のコードベースクリーンアップが不完全

## 受け入れ基準

- [ ] `.ts` ファイルが完全な正とすることを確認
- [ ] 全21個の `.js` 重複ファイルを削除
- [ ] ビルド・テストが通ることを確認
- [ ] `.gitignore` で `apps/server/src/**/*.js` を追加（ビルド出力除く）

## 対象ファイル

- `apps/server/src/` 配下の21個の `.js` ファイル
