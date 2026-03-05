# Deck IDE

複数のターミナルを並列で管理できる軽量なWeb IDE。AIエージェント（Claude Code、Codex CLI等）を永続的に動かすことに最適化されています。

## 特徴

- **マルチターミナル** - 複数のターミナルを同時に起動・管理
- **Monaco Editor** - VS Codeと同じエディタエンジンによるコード編集
- **Git統合** - ステージング、コミット、プッシュ、プル、ブランチ管理
- **マルチリポジトリ対応** - ワークスペース内の複数Gitリポジトリを自動検出
- **ファイルエクスプローラー** - ファイル・フォルダの作成、削除、名前変更
- **Diffビューア** - 変更ファイルの差分表示
- **Windowsデスクトップアプリ** - Electronベースのネイティブアプリ（自動アップデート対応）
- **Context Manager** - AIセッションの健全性を監視・管理

## スクリーンショット

```
[エクスプローラー] [Git] [設定]    Deck IDE
┌─────────┬───────────────────────────────────────────────────┐
│ ファイル │  Monaco Editor                                    │
│ ツリー   │                                                   │
│         │                                                    │
│         ├───────────────────────────────────────────────────┤
│         │  Terminal 1        │  Terminal 2                  │
│         │  $ claude          │  $ codex                     │
│         │  ...               │  ...                         │
└─────────┴───────────────────────────────────────────────────┘
```

## インストール

### Windowsデスクトップアプリ（推奨）

[Releases](https://github.com/tako0614/ide/releases)から最新の`Deck-IDE-Setup-x.x.x.exe`をダウンロードしてインストール。

### ソースから実行

```bash
# リポジトリをクローン
git clone https://github.com/tako0614/ide.git
cd ide

# 依存関係をインストール
bun install

# 開発モードで起動（Web + Server）
bun run dev:server  # ターミナル1
bun run dev:web     # ターミナル2

# またはビルドして起動
bun run serve
```

ブラウザで http://localhost:3210 を開く。

## プロジェクト構成

```
ide/
├── apps/
│   ├── web/          # フロントエンド (React + Vite)
│   ├── server/       # バックエンド (Hono + node-pty)
│   └── desktop/      # Electronアプリ
├── packages/
│   └── shared/       # 共有型定義
└── docs/             # ドキュメント
```

## 技術スタック

### フロントエンド
- React 19
- Vite
- Monaco Editor
- xterm.js (WebGL対応)
- TypeScript

### バックエンド
- Hono (高速HTTPフレームワーク)
- node-pty (疑似ターミナル)
- simple-git (Git操作)
- WebSocket (ターミナル通信)
- SQLite (データ永続化)

### デスクトップ
- Electron 40
- electron-builder
- electron-updater (自動アップデート)

## 使い方

### ワークスペースの追加

1. 左サイドバーの「+」ボタンをクリック
2. ディレクトリパスを入力（例: `C:\Projects\myapp`）
3. ワークスペースが追加される

### デッキの作成

1. ワークスペースを選択
2. 「デッキ作成」ボタンをクリック
3. デッキ名を入力

### ターミナルの使用

- 「ターミナル追加」: 新しいターミナルを開く
- 「Claude」: `claude` コマンドを実行するターミナルを開く
- 「Codex」: `codex` コマンドを実行するターミナルを開く

### Git操作

1. サイドナビでGitアイコンをクリック
2. 変更ファイルを確認
3. 「+」でステージング、「−」でアンステージ
4. コミットメッセージを入力してコミット
5. プッシュ/プル/フェッチボタンで同期

## Context Manager

Deck IDEには、AIセッションの健全性を監視・管理する**Context Manager**が統合されています。

### コンテキスト健全性スコア (Context Health Score)

コンテキストの健全性を0-100のスコアで表現します。

| スコア範囲 | ステータス | 色 | アクション |
|-----------|-----------|---|----------|
| 80-100 | Excellent (優秀) | 緑 | スナップショット作成を検討 |
| 50-79 | Good (良好) | 黄緑 | 通常運用 |
| 30-49 | Warning (警告) | オレンジ | 圧縮を検討、エラーを確認 |
| 0-29 | Critical (危険) | 赤 | 圧縮またはスナップショット作成 |

**健全性の構成要素:**

- **Drift (トピック逸脱)**: 0-1 (1 = 完全に逸脱)
- **Errors (エラー率)**: 直近のアクティビティにおけるエラー頻度
- **Length (長さ)**: セッションのメッセージ・イベント数
- **Activity (アクティビティ)**: 直近の更新からの経過時間

### トピック逸脱検知 (Topic Drift Detection)

会話が初期のトピックからどれだけ逸脱したかを検知します。

**検出方法:**

1. **キーワードベース（高速）**: 常に実行
   - 初期プロンプトと最近のメッセージからキーワードを抽出
   - Jaccard類似度で比較
   - ファイルパス、技術用語、識別子を考慮

2. **LLMベース（高精度）**: キーワード逸脱が閾値を超えた時のみ実行
   - Claude APIを使用して意味的類似度を分析
   - 将来的な実装予定

**逸脱スコア:**
- 0.0-0.3: 低い逸脱（問題なし）
- 0.4-0.6: 中程度の逸脱（注意）
- 0.7-1.0: 高い逸脱（新しいセッションを検討）

### 自動圧縮・要約 (Auto-Compact)

セッションが長くなりすぎた場合に自動的に圧縮します。

**圧縮タイミング:**
- イベント数が100件を超えた時
- ヘルススコアが50を下回った時

**圧縮オプション:**
```typescript
{
  keepRecentEvents: 50,    // 保持する最近のイベント数
  compactThreshold: 100,   // 圧縮をトリガーするイベント数
}
```

**API:**
```typescript
// 手動圧縮
await manager.compact({
  keepRecentEvents: 50,
  compactThreshold: 100,
});
```

### スナップショットと復元 (Snapshots & Restore)

セッションの状態を任意のタイミングで保存・復元できます。

**スナップショット作成の推奨タイミング:**

1. **主要なリファクタリング前**
2. **機能完了後**
3. **ヘルススコアが大きく低下した時**
4. **コンテキストの切り替え時**
5. **重要なマイルストーン時**

**API:**
```typescript
// スナップショット作成
const snapshot = await manager.createSnapshot('Before refactoring');
console.log(`Snapshot: ${snapshot.commitHash}`);

// スナップショット一覧
const snapshots = manager.getSnapshots();

// 最新のスナップショット
const latest = manager.getLatestSnapshot();

// 最も健全なスナップショット
const best = manager.getHealthiestSnapshot();

// スナップショットから復元
await manager.restoreSnapshot(commitHash);
```

### 出力トリマー (Output Trimmer)

会話履歴をインテリジェントにトリミングして、重要なコンテキストを保持します。

**トリミング戦略:**
- システムメッセージを保持
- 最初のユーザーメッセージを保持
- 最近のN件のメッセージを保持
- 最大50件まで保持

**API:**
```typescript
// トリミング実行
const trimmed = manager.trimOutput({
  maxMessages: 50,
  preserveSystemMessages: true,
  preserveFirstMessage: true,
  preserveRecent: 10,
});
```

### フェーズ認識モード (Phase-Aware Modes)

セッションの現在のフェーズを自動検出します。

**フェーズの種類:**
- `active`: アクティブな作業中
- `warning`: 注意が必要
- `critical`: 即時のアクションが必要
- `ended`: セッション終了

**フェーズ検出:**
- 直近の5件のメッセージをスライディングウィンドウで分析
- ヘルススコアと逸脱スコアを考慮

## トラブルシューティング

### Health Scoreが低い時の対処法

**ステータス確認:**
```typescript
const status = await manager.getStatus();
console.log('Health factors:', status.healthScore);
console.log('Recommendations:', status.recommendations);
```

**対処法:**

1. **圧縮を実行**
   ```bash
   # Web UIの「Compact」ボタンをクリック
   # またはAPI: POST /api/context-manager/compact
   ```

2. **スナップショットを作成して復元**
   ```bash
   # Web UIの「Snapshot」ボタンをクリック
   # またはAPI: POST /api/context-manager/snapshot
   ```

3. **エラーを確認**
   ```typescript
   const drift = await manager.analyzeDrift();
   console.log('Drift score:', drift?.driftScore);
   ```

### Topic Driftが大きい時の対処法

**対処法:**

1. **スナップショットを作成**
   ```typescript
   await manager.createSnapshot('Before topic change');
   ```

2. **新しいセッションを開始**
   ```bash
   # Web UIの「New Session」ボタンをクリック
   # またはページを再読み込み
   ```

3. **逸脱閾値を調整**
   ```typescript
   manager.setDriftThreshold(0.8); // より寛容に
   ```

### スナップショットからの復元手順

1. **スナップショットを確認**
   ```typescript
   const snapshots = manager.getSnapshots();
   snapshots.forEach(s => {
     console.log(`${s.description}: ${s.healthScore}`);
   });
   ```

2. **復元するスナップショットを選択**
   ```typescript
   // 最も健全なスナップショットを復元
   const best = manager.getHealthiestSnapshot();
   if (best) {
     await manager.restoreSnapshot(best.commitHash);
   }
   ```

3. **特定のスナップショットを復元**
   ```bash
   # API経由で復元
   POST /api/context-manager/restore
   Body: { commitHash: "abc123def456" }
   ```

## ベストプラクティス

### 効率的なセッション管理

1. **定期的なスナップショット**
   - 主要なマイルストーンごとにスナップショットを作成
   - 機能完了時、リファクタリング前

2. **トピックが変わったら新しいセッション**
   - 逸脱スコアが0.7を超えたら検討
   - フロントエンドからバックエンドへ切り替える時など

3. **ヘルススコアを監視**
   - 30秒ごとに自動更新
   - 50を下回ったらアクションを実行

4. **適切な圧縮タイミング**
   - イベント数が75件を超えたら圧縮を検討
   - 重要なイベント（エラー、スナップショット）は保持

### 定期的なメンテナンス

1. **週次レビュー**
   - すべてのスナップショットを確認
   - 不要なスナップショットを削除

2. **月次クリーンアップ**
   - 古いセッションをアーカイブ
   - エラーパターンを分析

3. **設定の最適化**
   - プロジェクトに合わせて閾値を調整
   - `CONTEXT_MANAGER_CONFIG` を参照

## キーボードカスタマイズ

### エディタのショートカット

Monaco EditorはVS Codeと同じキーバインディングをサポートしています。

**基本ショートカット:**
- `Ctrl/Cmd + S`: 保存
- `Ctrl/Cmd + F`: 検索
- `Ctrl/Cmd + H`: 置換
- `Ctrl/Cmd + /`: コメントアウト
- `Ctrl/Cmd + D`: 単語を選択
- `Alt + Shift + F`: フォーマット

### ターミナルのショートカット

xterm.jsは一般的なターミナルショートカットをサポートしています。

**基本ショートカット:**
- `Ctrl/Cmd + C`: コピー（選択時）/ 割り込み（未選択時）
- `Ctrl/Cmd + V`: ペースト
- `Ctrl/Cmd + Shift + C`: コピー
- `Ctrl/Cmd + Shift + V`: ペースト
- `Ctrl/Cmd + Plus`: フォントサイズ拡大
- `Ctrl/Cmd + Minus`: フォントサイズ縮小

### カスタムキーバインディング

将来的には、設定ファイルでカスタムキーバインディングをサポートする予定です。

## 開発

```bash
# 依存関係のインストール
bun install

# 開発サーバー起動
bun run dev:server  # サーバー (port 3210)
bun run dev:web     # Web (port 5173)

# ビルド
bun run build:web   # Webのみ
bun run build:server # サーバーのみ
bun run build:desktop # デスクトップアプリ

# デスクトップアプリの開発
bun run dev:desktop
```

## 環境変数

サーバーは以下の環境変数をサポートします:

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `PORT` | サーバーポート | 3210 |
| `HOST` | バインドアドレス | localhost |
| `BASIC_AUTH_USER` | Basic認証ユーザー名 | (なし) |
| `BASIC_AUTH_PASSWORD` | Basic認証パスワード | (なし) |
| `CORS_ORIGIN` | CORS許可オリジン | * (開発時) |
| `DEFAULT_ROOT` | デフォルトルートパス | (なし) |

## API

### Context Manager

- `GET /api/context-manager/status` - ステータス取得
- `POST /api/context-manager/compact` - 圧縮実行
- `POST /api/context-manager/snapshot` - スナップショット作成
- `POST /api/context-manager/restore` - スナップショット復元

### ワークスペース
- `GET /api/workspaces` - ワークスペース一覧
- `POST /api/workspaces` - ワークスペース作成

### デッキ
- `GET /api/decks` - デッキ一覧
- `POST /api/decks` - デッキ作成

### ファイル
- `GET /api/files` - ファイル一覧
- `GET /api/file` - ファイル読み込み
- `PUT /api/file` - ファイル保存
- `POST /api/file` - ファイル作成
- `DELETE /api/file` - ファイル削除

### ターミナル
- `GET /api/terminals` - ターミナル一覧
- `POST /api/terminals` - ターミナル作成
- `DELETE /api/terminals/:id` - ターミナル削除
- `WS /api/terminals/:id` - ターミナル接続

### Git
- `GET /api/git/status` - Gitステータス
- `GET /api/git/repos` - リポジトリ一覧
- `POST /api/git/stage` - ステージング
- `POST /api/git/unstage` - アンステージ
- `POST /api/git/commit` - コミット
- `POST /api/git/push` - プッシュ
- `POST /api/git/pull` - プル
- `GET /api/git/diff` - 差分取得
- `GET /api/git/branches` - ブランチ一覧
- `POST /api/git/checkout` - ブランチ切り替え

## ライセンス

MIT

## 作者

[tako0614](https://github.com/tako0614)
