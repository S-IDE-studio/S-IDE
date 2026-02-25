# frontend.md — フロントエンド仕様

上位ドキュメント: [ARCHITECTURE.md](../../ARCHITECTURE.md) > [system.md](./system.md)

---

## 1. 概要

Web ClientはS-IDEのUI層。
**ビジネスロジックを含まず**、表示とユーザー入力の中継のみを担う（INV-1, P-1）。

**技術スタック:** React 18, TypeScript, Vite, Monaco Editor, xterm.js, dockview, Lucide React

## 2. 技術選定理由

| 技術 | 理由 |
|---|---|
| React 18 | コンポーネントベース設計、Concurrent Features、エコシステムの成熟度 |
| Vite | ESモジュールネイティブによる高速HMR |
| Monaco Editor | VS Codeと同一エンジン。IntelliSense・言語拡張 |
| xterm.js | 業界標準ターミナルエミュレータ。WebGLレンダリング対応 |
| dockview | 柔軟なドッキングパネルレイアウト |
| Lucide React | 軽量・tree-shakeable アイコン |

## 3. ディレクトリ構成

```
apps/web/src/
├── App.tsx               # メインオーケストレーター（ルート状態管理）
├── api.ts                # APIクライアント（REST + WebSocket）
├── main.tsx              # エントリポイント
├── constants.ts          # 定数定義
├── types.ts              # フロントエンド固有型
├── styles.css            # グローバルスタイル
├── components/           # 機能別コンポーネント
├── contexts/             # React Context（グローバル状態）
├── hooks/                # カスタムフック
├── features/             # 機能モジュール（AI workflow, context manager）
├── utils/                # フロントエンドユーティリティ
├── styles/               # スタイル関連
└── __tests__/            # テスト
```

## 4. 状態管理

### 4.1. 状態の所在

```
App.tsx (root state)          ← デッキ・ワークスペース・ターミナル・エディタ
    │
    ├── React Context         ← 認証・設定・テーマ等のグローバル状態
    │
    └── Component State       ← 各コンポーネントローカルのUI状態
```

### 4.2. INV-1準拠ルール

| 許可 | 禁止 |
|---|---|
| API呼び出しの結果をstateに格納 | Core Daemon側ロジックの再実装 |
| UI状態（開閉、選択、フォーカス）の管理 | データの加工・変換（Core Daemonで行う） |
| ユーザー入力のバリデーション（UX目的） | ビジネスルールの適用 |
| WebSocketメッセージの受信と表示 | WebSocketメッセージの加工・フィルタリング |

## 5. APIクライアント (`api.ts`)

- Core DaemonのREST APIと1:1で対応する型安全なラッパーを提供
- WebSocket接続管理を内包
- エラーハンドリングは呼び出し元コンポーネントの責務

### 5.1. 新しいAPI呼び出しを追加する手順

```
1. Core Daemon にAPIルートを先に実装する
2. api.ts にラッパー関数を追加する
3. コンポーネントから呼び出す
```

## 6. コンポーネント設計指針

- **features/** は機能単位の複合コンポーネント
- **components/** は再利用可能な単位コンポーネント
- **hooks/** はロジックの抽出（useTerminal, useAgent 等）
- コンポーネントは**表示に特化**し、副作用は hooks に委譲する

## 7. ビルドとデプロイ

| モード | コマンド | 出力 |
|---|---|---|
| 開発 | `pnpm run dev` (via `vite`) | localhost:5173 |
| ビルド | `pnpm run build` (via `vite build`) | `apps/web/dist/` |
| プレビュー | `pnpm run preview` | ビルド成果物のサーブ |

ビルド成果物はTauriデスクトップアプリにバンドルされる（`tauri.conf.json` の `frontendDist`）。

## 8. Tauri連携

Desktop版では以下のTauri APIを使用:
- `@tauri-apps/api` — Tauriコマンド呼び出し
- `@tauri-apps/plugin-dialog` — ネイティブダイアログ
- `@tauri-apps/plugin-updater` — 自動更新
- `@tauri-apps/plugin-process` — プロセス制御

**重要:** Tauri APIは `window.__TAURI__` の存在で条件分岐すること。Web版では利用不可。
