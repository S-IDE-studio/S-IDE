## 概要

`server.md` §5.1, §5.2, §5.3 で定義されている `/api/health` および `/api/health/ports` エンドポイントが実装されていない。

## ドキュメントの要求

### `/api/health` 応答仕様 (server.md §5.2)

```json
{
  "status": "healthy",
  "uptime": 3600,
  "pid": 12345,
  "version": "0.1.0",
  "ports": { "http": 8787, "ws": 8787 },
  "database": "connected",
  "mcpServers": { "running": 3, "error": 0, "stopped": 1 },
  "agents": { "enabled": 4, "installed": 3 }
}
```

### `/api/health/ports` 応答仕様 (server.md §5.3)

```json
{
  "coreDaemon": { "port": 8787, "status": "listening" },
  "mcpServers": [...],
  "conflicts": []
}
```

## 影響するINV

- **INV-6 (Observable & Interruptible, P-1):** ヘルスチェックは可観測性の基本。外部からDaemonの健全性を確認できない状態はP-1違反
- Tauri Desktop Shell の `DaemonLifecycle` (desktop.md §5) はヘルスチェックAPIに依存

## 受け入れ基準

- [ ] `GET /api/health` が仕様通りのJSONを返す
- [ ] `GET /api/health/ports` が使用中ポート一覧を返す
- [ ] ヘルスチェック失敗時のDesktop Shell側対応（自動再起動 or 通知）

## 対象ファイル

- `apps/server/src/routes/` (新規ルート追加)
- `apps/server/src/server.ts` (ルーター登録)
