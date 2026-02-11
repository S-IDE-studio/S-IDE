# タブパネルシステムの dockview 移行

> **For Claude:** Execute with subagent-driven-development

**日付:** 2026-02-11
**ステータス:** Plan

---

## 概要

S-IDE の自作タブパネル＋グリッドシステムを、[dockview](https://github.com/mathuo/dockview) ライブラリに置き換える。
dockview は VSCode と同様のドッキング・パネルシステムを提供し、タブのドラッグ&ドロップ、パネル分割、リサイズ、レイアウトの永続化（`toJSON`/`fromJSON`）を標準でサポートする。

### 移行の目的

- 自作のグリッド＆パネルシステム（約5000行+）を削除し、保守性を大幅に向上
- `@dnd-kit` 依存の独自D&D実装を dockview 組み込みのD&Dに置き換え
- VSCode と同等のパネル操作体験（タブ移動、グループ分割、フローティング等）を低コストで実現
- レイアウトの永続化を`toJSON`/`fromJSON` APIで簡潔に実装

---

## 現在のアーキテクチャ（置き換え対象）

### 削除対象ファイル

```
apps/web/src/components/grid/          # 自作グリッドシステム（全ファイル削除）
├── GridView.tsx                        # メイングリッドコンポーネント (855行)
├── GridBranchNode.tsx                  # ブランチノード
├── GridLeafNode.tsx                    # リーフノード
├── GridDropTarget.tsx                  # グリッドドロップターゲット
├── SplitView.tsx                       # スプリットビュー
├── Sash.tsx                            # リサイズハンドル
└── index.ts                            # エクスポート

apps/web/src/components/panel/          # 置き換え対象パネルコンポーネント
├── UnifiedPanelView.tsx                # パネルオーケストレーター（削除）
├── UnifiedPanelContainer.tsx           # パネルグループコンテナ（削除）
├── PanelTabList.tsx                    # タブリスト（削除、dockview標準タブに）
├── DraggableTab.tsx                    # D&Dタブ（削除、dockview標準D&Dに）
├── DropOverlay.tsx                     # ドロップオーバーレイ（削除）
├── PanelSplitButton.tsx                # 分割ボタン（削除）
├── PanelResizeHandle.tsx               # リサイズハンドル（削除）
├── TabContextMenu.tsx                  # 右クリックメニュー（保持、dockviewに接続）
└── PanelContent.tsx                    # コンテンツディスパッチャー（リファクタリング）

apps/web/src/utils/
├── gridUtils.ts                        # グリッドユーティリティ (908行, 削除)
└── unifiedTabUtils.ts                  # タブ変換ユーティリティ (262行, リファクタリング)
└── tabMigration.ts                     # タブ移行ユーティリティ (リファクタリング)
└── tabsSync.ts                         # タブ同期 (リファクタリング)
```

### 保持するファイル（コンテンツコンポーネント）

以下はパネルの中身を描画するコンポーネントで、dockview のパネルコンポーネントとして再利用する：

```
apps/web/src/components/panel/
├── AgentPanel.tsx                      # エージェント会話パネル
├── AgentStatusPanelContent.tsx         # エージェントステータス
├── AgentConfigPanelContent.tsx         # エージェント設定（グローバル）
├── AgentConfigLocalPanelContent.tsx    # エージェント設定（ワークスペース）
├── DeckPanel.tsx                       # デッキ（ファイルツリー＋編集）
├── EditorPanelContent.tsx              # Monaco Editorパネル
├── McpPanelContent.tsx                 # MCPサーバー管理
├── RemoteAccessPanelContent.tsx        # リモートアクセス
├── ServerPanelContent.tsx              # サーバーモニター
├── ServerSettingsPanelContent.tsx      # サーバー設定
├── SetupPanelContent.tsx               # セットアップ
├── TerminalPanelContent.tsx            # ターミナル (xterm.js)
└── WorkspacePanel.tsx                  # ワークスペース一覧
```

### 現在の型定義（`apps/web/src/types.ts`）

```typescript
// タブの種類（14種類）
export type TabKind =
  | "agent" | "workspace" | "deck" | "terminal" | "editor"
  | "server" | "mcp" | "remoteAccess" | "tunnel"
  | "serverSettings" | "agentStatus" | "agentConfig"
  | "agentConfigLocal" | "setup";

export interface UnifiedTab {
  id: string;
  kind: TabKind;
  title: string;
  icon?: string;
  dirty?: boolean;
  pinned?: boolean;
  synced?: boolean;
  syncKey?: string;
  data: {
    agent?: { id: string; name: string; icon: string };
    workspace?: { id: string; path: string; name: string };
    deck?: { id: string; name: string; root: string; workspaceId: string };
    terminal?: { id: string; command: string; cwd: string; workspaceId?: string };
    editor?: EditorFile;
    server?: { id: string; name: string };
    remoteAccess?: { id: string; name: string };
    tunnel?: { id: string; name: string; url?: string; status?: string };
    mcp?: { id: string; name: string };
    serverSettings?: {};
    agentStatus?: {};
    agentConfig?: {};
    agentConfigLocal?: { workspaceId: string };
    setup?: {};
  };
}

export interface PanelGroup {
  id: string;
  tabs: UnifiedTab[];
  activeTabId: string | null;
  focused: boolean;
  percentage: number;
}

export interface PanelLayout {
  direction: "horizontal" | "vertical" | "single";
  sizes: number[];
}

// GridState系の型（GridBranchNode, GridLeafNode, GridNode, GridState 等）
```

### 現在のApp.tsx状態管理

App.tsx では以下の状態を管理している：
- `gridState: GridState` — グリッドツリー構造
- `panelGroupsMap: Record<string, PanelGroup>` — 各リーフノードに対応するタブグループ
- `focusedPanelGroupId: string | null` — フォーカス中のグループ
- `loadTabState()` / `saveTabState()` で localStorage に永続化

### 現在の依存パッケージ

```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```

---

## dockview 設計

### パッケージ

```bash
pnpm -F side-web add dockview
pnpm -F side-web remove @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

注意: `@dnd-kit` は他の場所でも使用されている可能性があるため、削除前に `grep` で確認すること。

### dockview の基本構造

```tsx
import { DockviewReact, DockviewReadyEvent, DockviewApi, IDockviewPanelProps } from 'dockview';

// 1. パネルコンポーネントを定義
const components = {
  agent: (props: IDockviewPanelProps) => <AgentPanel {...adaptProps(props)} />,
  editor: (props: IDockviewPanelProps) => <EditorPanelContent {...adaptProps(props)} />,
  terminal: (props: IDockviewPanelProps) => <TerminalPanelContent {...adaptProps(props)} />,
  // ... 全 TabKind に対応するコンポーネント
};

// 2. DockviewReact を配置
<DockviewReact
  className="dockview-theme-abyss"
  onReady={handleReady}
  components={components}
  watermarkComponent={EmptyPanelWatermark}
/>

// 3. onReady で API を取得
const handleReady = (event: DockviewReadyEvent) => {
  dockviewApiRef.current = event.api;
  // レイアウト復元 or 初期レイアウト構築
};

// 4. パネル追加
dockviewApi.addPanel({
  id: tabId,
  component: tabKind,  // TabKind をそのまま component 名に
  title: tab.title,
  params: { tab },     // UnifiedTab をまるごと params に渡す
});
```

### UnifiedTab → dockview パネル マッピング

各 `UnifiedTab` を dockview の `addPanel` に変換する：

```typescript
function addUnifiedTabToPanel(api: DockviewApi, tab: UnifiedTab, position?: AddPanelPositionOptions) {
  return api.addPanel({
    id: tab.id,
    component: tab.kind,     // TabKind = component名
    title: tab.title,
    params: {
      tab,                    // UnifiedTab をそのまま渡す
    },
    position,
  });
}
```

### レイアウト永続化

```typescript
// 保存: dockview のシリアライゼーション + タブデータ
function saveLayout(api: DockviewApi) {
  const serialized = api.toJSON();
  // params内のtabデータも含まれるのでそのまま保存可能
  localStorage.setItem('side-ide-layout', JSON.stringify(serialized));
}

// 復元
function restoreLayout(api: DockviewApi) {
  const saved = localStorage.getItem('side-ide-layout');
  if (saved) {
    api.fromJSON(JSON.parse(saved));
  } else {
    buildDefaultLayout(api);
  }
}
```

### カスタムテーマ

dockview の CSS 変数をプロジェクトのダークテーマに合わせてオーバーライドする：

```css
.dockview-theme-side {
  --dv-group-view-background-color: var(--bg-primary);
  --dv-tabs-and-actions-container-background-color: var(--bg-secondary);
  --dv-activegroup-visiblepanel-tab-background-color: var(--bg-primary);
  --dv-activegroup-hiddenpanel-tab-background-color: var(--bg-secondary);
  --dv-inactivegroup-visiblepanel-tab-background-color: var(--bg-tertiary);
  --dv-inactivegroup-hiddenpanel-tab-background-color: var(--bg-secondary);
  --dv-tab-divider-color: var(--border-color);
  --dv-separator-border: var(--border-color);
  /* ... 他のカスタムプロパティ */
}
```

### カスタムタブコンポーネント

既存のタブアイコンとスタイルを維持するためにカスタムタブを使用：

```tsx
import { IDockviewPanelHeaderProps } from 'dockview';

const CustomTab = (props: IDockviewPanelHeaderProps) => {
  const tab: UnifiedTab = props.params.tab;
  return (
    <div className={`dockview-tab ${tab.dirty ? 'dirty' : ''} ${tab.pinned ? 'pinned' : ''}`}>
      <TabIcon kind={tab.kind} />
      <span className="tab-title">{tab.title}</span>
      {tab.dirty && <span className="dirty-indicator">●</span>}
      <button className="tab-close" onClick={() => props.api.close()}>×</button>
    </div>
  );
};
```

---

## 実装タスク

### Task 1: dockview パッケージのインストール

**操作:**
```bash
cd apps/web
pnpm add dockview
```

`@dnd-kit` はパネル以外で使用されていないか確認。パネルシステムのみで使用している場合は削除：
```bash
pnpm remove @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**検証:** `pnpm run type-check` が通ること。

---

### Task 2: dockview ラッパーコンポーネントの作成

**新規作成:** `apps/web/src/components/dockview/DockviewLayout.tsx`

dockview を初期化し、S-IDE のアプリケーション状態と接続するラッパーコンポーネントを作成する。

**要件:**
1. `DockviewReact` を配置
2. `onReady` で `DockviewApi` を取得して `useRef` に保存
3. 全 `TabKind` に対応する `components` マップを定義
4. パネルへのpropsは `React.Context` 経由で渡す（dockview の params は serializable 値が推奨のため、コールバック関数やReactオブジェクトは Context で供給する）
5. カスタムタブコンポーネント（`defaultTabComponent`）を提供
6. `watermarkComponent` で空のグループに表示するウォーターマークを定義
7. `rightHeaderActionsComponent` でグループヘッダーにカスタムアクション（分割、閉じる等）を追加
8. dockview のカスタムテーマクラス `dockview-theme-side` を適用

**新規作成:** `apps/web/src/components/dockview/DockviewContext.tsx`

パネルコンテンツコンポーネントに共有データ（ワークスペース状態、デッキ状態、ハンドラ等）を渡すための Context を作成する。

**型定義:**
```typescript
interface DockviewContextValue {
  // ワークスペース関連
  workspaceStates: Record<string, WorkspaceState>;
  updateWorkspaceState: (id: string, state: Partial<WorkspaceState>) => void;
  // デッキ関連
  decks: Deck[];
  deckStates: Record<string, DeckState>;
  activeDeckIds: Record<string, string>;
  // Git
  gitFiles: Record<string, GitFileStatus[]>;
  // ファイル操作
  onToggleDir: (wsId: string, node: FileTreeNode) => void;
  onOpenFile: (wsId: string, node: FileTreeNode) => void;
  onRefreshTree: (wsId: string) => void;
  onCreateFile: (wsId: string, path: string) => void;
  onCreateDirectory: (wsId: string, path: string) => void;
  onDeleteFile: (wsId: string, path: string) => void;
  onDeleteDirectory: (wsId: string, path: string) => void;
  // エディタ操作
  onChangeFile: (fileId: string, content: string) => void;
  onSaveFile: (fileId: string) => void;
  savingFileId: string | null;
  // ターミナル操作
  wsBase: string;
  onDeleteTerminal: (termId: string) => void;
  onReorderTerminals: (...args: any[]) => void;
  onCreateTerminal: (deckId: string, command?: string) => void;
  // タブ操作
  openTab: (tab: UnifiedTab) => void;
  // DockviewApi
  dockviewApi: DockviewApi | null;
}
```

---

### Task 3: パネルコンポーネントアダプターの作成

**新規作成:** `apps/web/src/components/dockview/panels/` 配下

各パネルコンテンツコンポーネントを `IDockviewPanelProps` に適合させるアダプターを作成する。
これにより、既存のコンテンツコンポーネント（AgentPanel, EditorPanelContent 等）を修正せずに再利用できる。

```typescript
// 例: apps/web/src/components/dockview/panels/AgentPanelAdapter.tsx
import { IDockviewPanelProps } from 'dockview';
import { useDockviewContext } from '../DockviewContext';
import { AgentPanel } from '../../panel/AgentPanel';

export function AgentPanelAdapter(props: IDockviewPanelProps<{ tab: UnifiedTab }>) {
  const ctx = useDockviewContext();
  const tab = props.params.tab;
  return <AgentPanel tab={tab} wsBase={ctx.wsBase} /* 必要なprops */ />;
}
```

全 `TabKind` に対応するアダプターを作成する：
- `AgentPanelAdapter`
- `WorkspacePanelAdapter`
- `DeckPanelAdapter`
- `EditorPanelAdapter`
- `TerminalPanelAdapter`
- `ServerPanelAdapter`
- `McpPanelAdapter`
- `RemoteAccessPanelAdapter`
- `ServerSettingsPanelAdapter`
- `AgentStatusPanelAdapter`
- `AgentConfigPanelAdapter`
- `AgentConfigLocalPanelAdapter`
- `SetupPanelAdapter`

---

### Task 4: カスタムタブコンポーネントの作成

**新規作成:** `apps/web/src/components/dockview/DockviewTab.tsx`

現在の `DraggableTab.tsx` の見た目を再現するカスタムタブコンポーネント：

**要件:**
1. `IDockviewPanelHeaderProps` を受け取る
2. `params.tab` から `TabKind` に応じたアイコンを表示
3. `dirty` インジケーター表示
4. `pinned` タブのスタイル
5. 閉じるボタン（`props.api.close()`）
6. 右クリックでコンテキストメニュー（既存の `TabContextMenu` を活用）
7. ダブルクリックでタブのピン留めトグル

---

### Task 5: カスタムテーマ CSS の作成

**新規作成 or 追記:** `apps/web/src/styles.css` もしくは `apps/web/src/components/dockview/dockview-theme.css`

**要件:**
1. `dockview-theme-side` クラスを定義
2. 現在のプロジェクトのカラースキーム（`--bg-primary`, `--bg-secondary` 等）に合わせて dockview の CSS 変数をオーバーライド
3. `dockview/dist/styles/dockview.css` を import する（もしくは index.html / main.tsx で読み込み）
4. 既存の `.panel-*` CSS クラスは段階的に削除（最後のタスクで一括削除）

---

### Task 6: App.tsx の統合

**修正:** `apps/web/src/App.tsx`

**要件:**
1. `MemoizedGridView` の使用を `DockviewLayout` に置き換え
2. `gridState`, `panelGroupsMap`, `focusedPanelGroupId` の状態管理を削除
3. `DockviewApi` の ref を保持し、タブ追加/削除操作を `api.addPanel()` / `api.removePanel()` で行う
4. レイアウトの永続化を `api.toJSON()` / `api.fromJSON()` で行う
5. `loadTabState` / `saveTabState` を dockview のシリアライゼーションに対応させる
6. 既存のタブ操作ハンドラ（`handleSelectTab`, `handleCloseTab`, `handleSplitPanel` 等）を dockview API ベースに書き換え
7. `DockviewContextProvider` で必要なデータとハンドラを供給
8. dockview イベント（`onDidLayoutChange`, `onDidAddPanel`, `onDidRemovePanel` 等）のリスナーを設定

**レイアウトの永続化の移行：**
- 既存の `loadTabState()` が返す `{ gridState, panelGroupsMap }` を読み込み
- データがある場合は一度 dockview の初期レイアウトとして変換して読み込む（移行パス）
- 新規保存は `api.toJSON()` のフォーマットで保存
- 既存フォーマットも読み込めるよう、フォールバック変換関数を用意する

---

### Task 7: レイアウト移行ユーティリティ

**新規作成:** `apps/web/src/utils/dockviewMigration.ts`

既存の `GridState` + `panelGroupsMap` フォーマットから dockview の `SerializedDockview` への変換関数を実装：

```typescript
import { SerializedDockview } from 'dockview';

export function migrateToSerializedDockview(
  gridState: GridState,
  panelGroupsMap: Record<string, PanelGroup>
): SerializedDockview {
  // GridState のツリーを dockview の grid 構造に変換
  // panelGroupsMap のタブを panels に変換
}
```

---

### Task 8: タブ同期の更新

**修正:** `apps/web/src/utils/tabsSync.ts` と `apps/web/src/hooks/useTabsPresenceSync.ts`

dockview API 経由でタブ一覧を取得・同期するように更新：

```typescript
// dockview API からタブ一覧を取得
function listAllTabs(api: DockviewApi): UnifiedTab[] {
  return api.panels.map(panel => panel.params.tab as UnifiedTab);
}
```

---

### Task 9: 不要ファイルの削除

**全削除:**
```
apps/web/src/components/grid/GridView.tsx
apps/web/src/components/grid/GridBranchNode.tsx
apps/web/src/components/grid/GridLeafNode.tsx
apps/web/src/components/grid/GridDropTarget.tsx
apps/web/src/components/grid/SplitView.tsx
apps/web/src/components/grid/Sash.tsx
apps/web/src/components/grid/index.ts
apps/web/src/components/panel/UnifiedPanelView.tsx
apps/web/src/components/panel/UnifiedPanelContainer.tsx
apps/web/src/components/panel/PanelTabList.tsx
apps/web/src/components/panel/DraggableTab.tsx
apps/web/src/components/panel/DropOverlay.tsx
apps/web/src/components/panel/PanelSplitButton.tsx
apps/web/src/components/panel/PanelResizeHandle.tsx
apps/web/src/utils/gridUtils.ts
```

**削除前に確認:**
- 上記ファイルの export が他から参照されていないこと（`grep` で確認）

**型定義の整理:**
- `apps/web/src/types.ts` から `GridBranchNode`, `GridLeafNode`, `GridNode`, `GridState`, `GridBox`, `GridViewSize`, `GridOrientation`, `GridLocation`, `Sizing`, `isGridBranchNode`, `isGridLeafNode` を削除
- `PanelGroup`, `PanelLayout` は dockview の型に置き換わるため削除（必要ならアダプター型として残す）
- `UnifiedTab`, `TabKind`, `TabContextMenuAction`, `SplitDirection` は保持

**CSS の整理:**
- `apps/web/src/styles.css` から `.panel-groups`, `.panel-group`, `.panel-tab-bar`, `.panel-tabs`, `.panel-tab`, `.panel-content`, `.panel-resize-handle`, `.drop-overlay`, `.split-button` 等の不要なスタイルを削除
- grid 関連の `.grid-view`, `.grid-branch`, `.grid-leaf`, `.sash` 等のスタイルも削除

---

### Task 10: テストの更新

**修正/新規:**
- 既存テスト内で `PanelGroup`, `GridState` 等を使用しているテストを更新
- `DockviewLayout` のテストを追加
- dockview API のモック方法: `DockviewApi` のインスタンスをモックし、`addPanel`, `removePanel`, `toJSON`, `fromJSON` 等をスタブ化

---

## 技術的な注意点

### 1. dockview params での非 serializable データ

dockview の `params` にはプレーンなオブジェクトを渡す。コールバック関数や React ノードは **Context** で渡す。

```typescript
// ❌ NG: params にコールバックを渡す
api.addPanel({ params: { onSave: () => {} } });

// ✅ OK: Context で供給
const ctx = useDockviewContext(); // コンポーネント内で
```

### 2. ターミナル (xterm.js) のライフサイクル

dockview はデフォルトで非アクティブなパネルの DOM を破棄する（`onlyWhenVisible` レンダリング）。xterm.js ターミナルは DOM が破棄されると状態を失う。

**対策:** ターミナルパネルは `renderer: 'always'` で登録する：
```typescript
api.addPanel({
  id: terminalTabId,
  component: 'terminal',
  renderer: 'always',  // DOM を常に維持
  // ...
});
```

### 3. Monaco Editor のライフサイクル

同様に、Monaco Editor も DOM の再マウントに注意が必要。ただし `@monaco-editor/react` は内部でインスタンスを管理しているのでそのまま動く可能性が高い。問題が出た場合は `renderer: 'always'` を使用する。

### 4. レイアウト自動リサイズ

dockview はデフォルトでコンテナのリサイズを自動検出する（`disableAutoResizing: false`）。サイドバーの開閉時に自動で再レイアウトされる。

### 5. タブのコンテキストメニュー

dockview は `onTabContextMenu` イベントを提供するので、既存の `TabContextMenu` コンポーネントを接続する：

```typescript
api.onTabContextMenu((event) => {
  // event.panel, event.event (native MouseEvent) が取得できる
  showContextMenu(event.event, event.panel);
});
```

---

## CSS で使用する dockview import

```typescript
// main.tsx で import
import 'dockview/dist/styles/dockview.css';
```

---

## 検証チェックリスト

各タスク完了時に以下を確認：

- [ ] `pnpm run type-check` が通る
- [ ] `pnpm run dev` でアプリが起動する
- [ ] 新規レイアウトが正しく表示される
- [ ] 保存済みレイアウトが復元される
- [ ] タブの追加/閉じる/移動が動作する
- [ ] パネルの分割（上下左右）が動作する
- [ ] パネルのリサイズが動作する
- [ ] タブのドラッグ&ドロップが動作する
- [ ] エディタでファイルが開ける
- [ ] ターミナルが正しく表示・入力できる
- [ ] エージェントパネルが動作する
- [ ] ダークテーマが正しく適用される
- [ ] 右クリックメニューが動作する
- [ ] `pnpm run test` が通る（テスト修正後）
