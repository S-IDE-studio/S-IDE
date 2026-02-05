# VSCode風統合タブパネルシステム 設計書

**日付:** 2025-02-05
**ステータス:** Design
**作成者:** Claude Code

## 概要

S-IDEの全パネル（エージェント、ワークスペース、デッキ、ターミナル、エディタ）をVSCode風の統合タブパネルシステムに変換する。

### 対象パネル

| パネル | 現在の実装 | 目標 |
|--------|------------|------|
| エージェント | AgentTabBar | VSCode風タブパネル |
| ワークスペース | WorkspaceList | VSCode風タブパネル |
| デッキ | deck-tab | VSCode風タブパネル |
| ターミナル | TerminalPane | VSCode風タブパネル |
| エディタ | EditorPane | VSCode風タブパネル（実装済み） |

## アーキテクチャ

### 統合データモデル

```typescript
// タブの種類
export type TabKind = 'agent' | 'workspace' | 'deck' | 'terminal' | 'editor';

// 統合タブ型
export interface UnifiedTab {
  id: string;
  kind: TabKind;
  title: string;
  description?: string;
  icon?: string;
  dirty?: boolean;
  // 種類ごとのデータ
  data?: {
    agent?: { id: string; name: string; icon: string };
    workspace?: { id: string; path: string; name: string };
    deck?: { id: string; name: string; root: string };
    terminal?: { id: string; command: string; cwd: string };
    editor?: EditorFile;
  };
}

// パネルグループ
export interface PanelGroup {
  id: string;
  tabs: UnifiedTab[];
  activeTabId: string | null;
  focused: boolean;
  percentage: number;
}

// レイアウト
export interface PanelLayout {
  direction: 'horizontal' | 'vertical' | 'single';
  sizes: number[];
}
```

### コンポーネント構造

```
AppRoot
├── ActivityBar (左サイドバー、既存)
├── MainContent
│   ├── UnifiedPanelContainer (統合パネルコンテナ)
│   │   ├── TabBar (VSCode風タブバー)
│   │   ├── PanelContent (タブの種類に応じたコンテンツ)
│   │   │   ├── AgentPanel
│   │   │   ├── WorkspacePanel
│   │   │   ├── DeckPanel
│   │   │   ├── TerminalPanel
│   │   │   └── EditorPanel
│   │   └── PanelStatusBar (ステータスバー)
│   └── Resizer (リサイザー、複数グループ時)
└── AuxiliaryBar (オプション、ファイルツリー等)
```

## ステート管理

### AppState拡張

```typescript
interface AppState {
  // 統合パネル
  panelGroups: PanelGroup[];
  panelLayout: PanelLayout;
  focusedPanelId: string | null;

  // サイドバー
  sidebarPanel: SidebarPanel | null; // files, git, search, etc.

  // 既存の状態
  workspaces: Workspace[];
  decks: Deck[];
  agents: Agent[];
  // ...
}
```

## 実装フェーズ

### フェーズ1: 統合タブ型定義とユーティリティ

1. `UnifiedTab`型定義
2. タブ変換ユーティリティ（各種データ→UnifiedTab）
3. パネル管理ユーティリティ

### フェーズ2: 統合タブバーコンポーネント

1. `UnifiedTabBar` コンポーネント
2. タブのドラッグ&ドロップ（@dnd-kit）
3. タブの並べ替え
4. タブのクローズ

### フェーズ3: パネルコンテンツコンポーネント

1. `AgentPanelContent` - エージェントパネル
2. `WorkspacePanelContent` - ワークスペースパネル
3. `DeckPanelContent` - デッキパネル（ターミナルを含む）
4. `EditorPanelContent` - エディタパネル（既存のEditorPane）

### フェーズ4: 統合パネルコンテナ

1. `UnifiedPanelContainer` コンポーネント
2. パネルの切り替え
3. パネルの分割（水平/垂直）
4. リサイズ機能

### フェーズ5: App.tsx統合

1. 既存のUIを統合システムに置き換え
2. ステート管理の更新
3. イベントハンドラーの接続

## データフロー

### タブ追加フロー

```
ユーザー操作
  → handleOpen[Agent/Workspace/Deck/Terminal/Editor]
  → toUnifiedTab() で変換
  → addTabToPanel()
  → updatePanelGroups()
  → レンダリング
```

### パネル分割フロー

```
ユーザーが「分割」操作
  → handleSplitPanel(panelId, direction)
  → 現在のアクティブタブを取得
  → 新しいPanelGroupを作成
  → panelLayoutを更新
  → レンダリング
```

### タブ移動フロー

```
ユーザーがタブをドラッグ
  → onDragEnd
  → タブの移動先パネルを検出
  → removeTabFromSourcePanel()
  → addTabToTargetPanel()
  → updateActiveTab()
  → レンダリング
```

## UI/UX

### タブバー

- アクティブタブ: 背景色強調
- 各種類ごとのアイコン
- ドラッグで並べ替え
- 中クリック/×ボタンで閉じる
- タブの種類を視覚的に区別（色、アイコン）

### パネル境界

- フォーカス済み: 上部境界線強調
- リサイザー: ドラッグ可能なバー
- 最小幅: 200px

### タブの種類別スタイル

| 種類 | アイコン | 色 |
|------|---------|-----|
| エージェント | 🤖 | 紫 |
| ワークスペース | 📁 | 青 |
| デッキ | 📦 | 緑 |
| ターミナル | ⚙️ | 黄 |
| エディタ | 📄 | 白 |

## マイグレーション計画

### ステップ1: 並行実装

- 既存コンポーネントを保持
- 新しい統合システムを追加
- A/Bテスト

### ステップ2: 機能移行

- 各パネルの機能を統合システムに移行
- データフローの検証
- テスト追加

### ステップ3: 完全置き換え

- 既存コンポーネントを削除
- 統合システムのみに
- ドキュメント更新

## 実装タスク

1. **型定義の拡張** - UnifiedTab, PanelGroup型
2. **変換ユーティリティ** - 各種データ→UnifiedTab変換
3. **UnifiedTabBar** - 統合タブバーコンポーネント
4. **UnifiedPanelContainer** - 統合パネルコンテナ
5. **パネルコンテンツ** - 各種類のコンテンツコンポーネント
6. **App.tsx統合** - メインアプリへの統合
7. **ドラッグ&ドロップ** - タブ移動機能
8. **リサイズ機能** - パネルリサイザー
9. **テスト** - 各コンポーネントのテスト
10. **既存UI削除** - 旧コンポーネントの削除

## 関連ファイル

- `apps/web/src/components/AgentTabs/` - 既存のエージェントタブ
- `apps/web/src/components/WorkspaceList.tsx` - 既存のワークスペースリスト
- `apps/web/src/components/DeckList.tsx` - 既存のデッキリスト
- `apps/web/src/components/TerminalPane.tsx` - 既存のターミナルペイン
- `apps/web/src/components/EditorPane.tsx` - エディタパネル（実装済み）
