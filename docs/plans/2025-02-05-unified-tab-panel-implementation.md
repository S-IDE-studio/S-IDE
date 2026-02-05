# VSCode風統合タブパネルシステム 実装計画

> **For Claude:** Execute with subagent-driven-development

**Goal:** S-IDEの全パネル（エージェント、ワークスペース、デッキ、ターミナル、エディタ）をVSCode風の統合タブパネルシステムに変換する。タブバーはなく、タイトルバーからパネルを管理し、各パネル内でタブを切り替える。

**Architecture:**
- タイトルバーからパネルの追加・切り替え
- 統合パネルコンテナ（分割可能）
- 各パネル内にタブ一覧
- @dnd-kitでパネルのリサイズ

**Tech Stack:** React 18, TypeScript, @dnd-kit, Monaco Editor, xterm.js

---

## 仕様

### UI構造

```
┌─────────────────────────────────────────────────────┐
│ TitleBar: [Panel Select] [Panel Actions]            │
├─────────────────────┬───────────────────────────────┤
│                     │                               │
│  PanelGroup 1       │  PanelGroup 2                │
│  ┌─────────────┐    │  ┌─────────────┐              │
│  │ Tab List    │    │  │ Tab List    │              │
│  ├─────────────┤    │  ├─────────────┤              │
│  │ Agent Tab 1 │    │  │ Editor Tab  │              │
│  │ Agent Tab 2 │    │  │ Terminal Tab│              │
│  └─────────────┘    │  └─────────────┘              │
│  ┌─────────────┐    │  ┌─────────────┐              │
│  │ Content     │    │  │ Content     │              │
│  │ (Agent)     │    │  │ (Editor)    │              │
│  │             │    │  │             │              │
│  └─────────────┘    │  └─────────────┘              │
│                     │  ◄─ Resizer ──►                │
└─────────────────────┴───────────────────────────────┘
```

### タイプ定義

```typescript
// タブの種類
export type TabKind = 'agent' | 'workspace' | 'deck' | 'terminal' | 'editor';

// 統合タブ
export interface UnifiedTab {
  id: string;
  kind: TabKind;
  title: string;
  icon?: string;
  dirty?: boolean;
  // 種類ごとのデータ
  data: {
    agent?: AgentData;
    workspace?: WorkspaceData;
    deck?: DeckData;
    terminal?: TerminalData;
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

// パネルレイアウト
export interface PanelLayout {
  direction: 'horizontal' | 'vertical' | 'single';
  sizes: number[];
}
```

## 実装タスク

### Task 1: 型定義の拡張

**Files:**
- Modify: `apps/web/src/types.ts`

**Step 1: 統合タブ型を追加**

```typescript
export type TabKind = 'agent' | 'workspace' | 'deck' | 'terminal' | 'editor';

export interface UnifiedTab {
  id: string;
  kind: TabKind;
  title: string;
  icon?: string;
  dirty?: boolean;
  data: {
    agent?: { id: string; name: string; icon: string };
    workspace?: { id: string; path: string; name: string };
    deck?: { id: string; name: string; root: string; workspaceId: string };
    terminal?: { id: string; command: string; cwd: string };
    editor?: EditorFile;
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
  direction: 'horizontal' | 'vertical' | 'single';
  sizes: number[];
}
```

**Step 2: コミット**

```bash
git add apps/web/src/types.ts
git commit -m "feat: add UnifiedTab and PanelGroup types"
```

---

### Task 2: 変換ユーティリティ

**Files:**
- Create: `apps/web/src/utils/unifiedTabUtils.ts`

**Step 1: ユーティリティ関数を実装**

```typescript
import type { UnifiedTab, TabKind } from "../types";
import type { Agent, Deck, Workspace, EditorFile } from "../types";

export function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function generatePanelGroupId(): string {
  return `panel-group-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// エージェント→タブ
export function agentToTab(agent: Agent): UnifiedTab {
  return {
    id: generateTabId(),
    kind: 'agent',
    title: agent.name,
    icon: agent.icon,
    data: { agent: { id: agent.id, name: agent.name, icon: agent.icon } },
  };
}

// ワークスペース→タブ
export function workspaceToTab(workspace: Workspace): UnifiedTab {
  const name = workspace.path.split(/[/\\]/).pop() || workspace.path;
  return {
    id: generateTabId(),
    kind: 'workspace',
    title: name,
    icon: '📁',
    data: { workspace: { id: workspace.id, path: workspace.path, name } },
  };
}

// デッキ→タブ
export function deckToTab(deck: Deck): UnifiedTab {
  return {
    id: generateTabId(),
    kind: 'deck',
    title: deck.name,
    icon: '📦',
    data: { deck: { id: deck.id, name: deck.name, root: deck.root, workspaceId: deck.workspaceId } },
  };
}

// ターミナル→タブ
export function terminalToTab(terminal: Terminal, deckId: string): UnifiedTab {
  return {
    id: generateTabId(),
    kind: 'terminal',
    title: terminal.command || 'Terminal',
    icon: '⚙️',
    data: { terminal: { id: terminal.id, command: terminal.command, cwd: terminal.cwd } },
  };
}

// エディタ→タブ
export function editorToTab(file: EditorFile): UnifiedTab {
  return {
    id: file.id,
    kind: 'editor',
    title: file.name,
    icon: getFileIcon(file.name).icon,
    dirty: file.dirty,
    data: { editor: file },
  };
}

function getFileIcon(filename: string): { icon: string } {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    ts: 'TS', tsx: 'TSX', js: 'JS', jsx: 'JSX',
    json: '{ }', html: '<>', css: '#', md: 'M↓',
    py: 'PY', go: 'GO', rs: 'RS',
  };
  return { icon: iconMap[ext] || '📄' };
}

// 空のパネルグループを作成
export function createEmptyPanelGroup(percentage: number = 100): PanelGroup {
  return {
    id: generatePanelGroupId(),
    tabs: [],
    activeTabId: null,
    focused: true,
    percentage,
  };
}

// 単一パネルレイアウトを作成
export function createSinglePanelLayout(): {
  groups: PanelGroup[];
  layout: PanelLayout;
} {
  return {
    groups: [createEmptyPanelGroup(100)],
    layout: { direction: 'single', sizes: [100] },
  };
}
```

**Step 2: コミット**

```bash
git add apps/web/src/utils/unifiedTabUtils.ts
git commit -m "feat: add unified tab conversion utilities"
```

---

### Task 3: PanelTabList コンポーネント

**Files:**
- Create: `apps/web/src/components/panel/PanelTabList.tsx`

**Step 1: パネル内タブリストコンポーネント**

```typescript
import { X } from "lucide-react";
import { memo } from "react";
import type { UnifiedTab } from "../../types";

interface PanelTabListProps {
  tabs: UnifiedTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export function PanelTabList({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
}: PanelTabListProps) {
  if (tabs.length === 0) {
    return (
      <div className="panel-tabs-empty">
        <span className="panel-tabs-empty-text">パネルが空です</span>
      </div>
    );
  }

  return (
    <div className="panel-tabs">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`panel-tab ${isActive ? 'active' : ''} ${tab.dirty ? 'dirty' : ''}`}
            onClick={() => onTabSelect(tab.id)}
          >
            <span className="panel-tab-icon">{tab.icon}</span>
            <span className="panel-tab-title">{tab.title}</span>
            <button
              type="button"
              className="panel-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              aria-label="閉じる"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export const MemoizedPanelTabList = memo(PanelTabList);
```

**Step 2: コミット**

```bash
git add apps/web/src/components/panel/PanelTabList.tsx
git commit -m "feat: add PanelTabList component"
```

---

### Task 4: PanelContent コンポーネント

**Files:**
- Create: `apps/web/src/components/panel/PanelContent.tsx`

**Step 1: パネルコンテンツコンポーネント**

```typescript
import { memo } from "react";
import { AgentPanel } from "./AgentPanel";
import { WorkspacePanel } from "./WorkspacePanel";
import { DeckPanel } from "./DeckPanel";
import { TerminalPanelContent } from "./TerminalPanelContent";
import { EditorPanelContent } from "./EditorPanelContent";
import type { UnifiedTab } from "../../types";

interface PanelContentProps {
  tab: UnifiedTab;
}

export function PanelContent({ tab }: PanelContentProps) {
  switch (tab.kind) {
    case 'agent':
      return <AgentPanel agent={tab.data.agent!} />;
    case 'workspace':
      return <WorkspacePanel workspace={tab.data.workspace!} />;
    case 'deck':
      return <DeckPanel deck={tab.data.deck!} />;
    case 'terminal':
      return <TerminalPanelContent terminal={tab.data.terminal!} />;
    case 'editor':
      return <EditorPanelContent file={tab.data.editor!} />;
    default:
      return <div>Unknown tab type</div>;
  }
}

export const MemoizedPanelContent = memo(PanelContent);
```

**Step 2: コミット**

```bash
git add apps/web/src/components/panel/PanelContent.tsx
git commit -m "feat: add PanelContent component"
```

---

### Task 5: UnifiedPanelContainer コンポーネント

**Files:**
- Create: `apps/web/src/components/panel/UnifiedPanelContainer.tsx`

**Step 1: 統合パネルコンテナ**

```typescript
import { memo, useCallback } from "react";
import type { PanelGroup } from "../../types";
import { PanelTabList } from "./PanelTabList";
import { PanelContent } from "./PanelContent";

interface UnifiedPanelContainerProps {
  group: PanelGroup;
  isFocused: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onFocus: () => void;
}

export function UnifiedPanelContainer({
  group,
  isFocused,
  onSelectTab,
  onCloseTab,
  onFocus,
}: UnifiedPanelContainerProps) {
  const activeTab = group.tabs.find((t) => t.id === group.activeTabId);

  const handleContainerClick = useCallback(() => {
    onFocus();
  }, [onFocus]);

  return (
    <div
      className={`panel-group ${isFocused ? 'focused' : ''}`}
      onClick={handleContainerClick}
    >
      {/* Tab List */}
      <PanelTabList
        tabs={group.tabs}
        activeTabId={group.activeTabId}
        onTabSelect={onSelectTab}
        onTabClose={onCloseTab}
      />

      {/* Content */}
      <div className="panel-content">
        {activeTab ? (
          <PanelContent tab={activeTab} />
        ) : (
          <div className="panel-empty">
            <p>パネルを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const MemoizedUnifiedPanelContainer = memo(UnifiedPanelContainer);
```

**Step 2: コミット**

```bash
git add apps/web/src/components/panel/UnifiedPanelContainer.tsx
git commit -m "feat: add UnifiedPanelContainer component"
```

---

### Task 6: UnifiedPanelView ルートコンポーネント

**Files:**
- Create: `apps/web/src/components/panel/UnifiedPanelView.tsx`

**Step 1: 統合パネルビュー**

```typescript
import { memo, useCallback } from "react";
import type { PanelGroup, PanelLayout, UnifiedTab } from "../../types";
import { createEmptyPanelGroup } from "../../utils/unifiedTabUtils";
import { MemoizedUnifiedPanelContainer } from "./UnifiedPanelContainer";

interface UnifiedPanelViewProps {
  groups: PanelGroup[];
  layout: PanelLayout;
  onSelectTab: (groupId: string, tabId: string) => void;
  onCloseTab: (groupId: string, tabId: string) => void;
  onFocusGroup: (groupId: string) => void;
  onSplitGroup?: (groupId: string, direction: 'horizontal' | 'vertical') => void;
  onCloseGroup?: (groupId: string) => void;
}

export function UnifiedPanelView({
  groups,
  layout,
  onSelectTab,
  onCloseTab,
  onFocusGroup,
  onSplitGroup,
  onCloseGroup,
}: UnifiedPanelViewProps) {
  const focusedGroupId = groups.find((g) => g.focused)?.id ?? groups[0]?.id;

  const handleSelectTab = useCallback(
    (groupId: string, tabId: string) => {
      onSelectTab(groupId, tabId);
    },
    [onSelectTab]
  );

  const handleCloseTab = useCallback(
    (groupId: string, tabId: string) => {
      onCloseTab(groupId, tabId);
    },
    [onCloseTab]
  );

  const handleFocusGroup = useCallback(
    (groupId: string) => {
      onFocusGroup(groupId);
    },
    [onFocusGroup]
  );

  // Single group
  if (layout.direction === 'single' || groups.length === 1) {
    const group = groups[0];
    if (!group) {
      return (
        <div className="panel-view-empty">
          <p>パネルを追加してください</p>
        </div>
      );
    }

    return (
      <MemoizedUnifiedPanelContainer
        key={group.id}
        group={group}
        isFocused={group.id === focusedGroupId}
        onSelectTab={(tabId) => handleSelectTab(group.id, tabId)}
        onCloseTab={(tabId) => handleCloseTab(group.id, tabId)}
        onFocus={() => handleFocusGroup(group.id)}
      />
    );
  }

  // Multiple groups
  return (
    <div className={`panel-groups panel-groups-${layout.direction}`}>
      {groups.map((group) => (
        <MemoizedUnifiedPanelContainer
          key={group.id}
          group={group}
          isFocused={group.id === focusedGroupId}
          onSelectTab={(tabId) => handleSelectTab(group.id, tabId)}
          onCloseTab={(tabId) => handleCloseTab(group.id, tabId)}
          onFocus={() => handleFocusGroup(group.id)}
        />
      ))}
    </div>
  );
}

export const MemoizedUnifiedPanelView = memo(UnifiedPanelView);
```

**Step 2: コミット**

```bash
git add apps/web/src/components/panel/UnifiedPanelView.tsx
git commit -m "feat: add UnifiedPanelView root component"
```

---

### Task 7: スタイル追加

**Files:**
- Modify: `apps/web/src/styles.css`

**Step 1: パネル用スタイルを追加**

```css
/* Panel Groups Container */
.panel-groups {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.panel-groups-horizontal {
  flex-direction: row;
}

.panel-groups-vertical {
  flex-direction: column;
}

/* Panel Group */
.panel-group {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid transparent;
  transition: border-color 0.15s ease;
}

.panel-group.focused {
  border-top-color: var(--accent-primary, #007acc);
  border-top-width: 2px;
}

/* Panel Tabs */
.panel-tabs {
  display: flex;
  overflow-x: auto;
  background: var(--bg-soft);
  min-height: 30px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.panel-tabs::-webkit-scrollbar {
  height: 0;
}

.panel-tabs-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-soft);
  min-height: 30px;
  border-bottom: 1px solid var(--border);
}

.panel-tabs-empty-text {
  font-size: 12px;
  color: var(--ink-muted);
}

.panel-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  min-width: 80px;
  height: 30px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--border);
  color: var(--ink-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.panel-tab:hover {
  background: var(--panel);
  color: var(--ink);
}

.panel-tab.active {
  background: var(--panel);
  color: var(--ink);
}

.panel-tab-icon {
  font-size: 10px;
}

.panel-tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-tab-close {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 3px;
  color: var(--ink-muted);
  cursor: pointer;
  opacity: 0;
}

.panel-tab:hover .panel-tab-close,
.panel-tab.active .panel-tab-close {
  opacity: 1;
}

.panel-tab.dirty .panel-tab-close {
  opacity: 0;
}

/* Panel Content */
.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ink-muted);
}

.panel-view-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ink-muted);
}
```

**Step 2: コミット**

```bash
git add apps/web/src/styles.css
git commit -m "style: add unified panel styles"
```

---

### Task 8: 各パネルコンテンツ実装

**Files:**
- Create: `apps/web/src/components/panel/AgentPanel.tsx`
- Create: `apps/web/src/components/panel/WorkspacePanel.tsx`
- Create: `apps/web/src/components/panel/DeckPanel.tsx`
- Create: `apps/web/src/components/panel/TerminalPanelContent.tsx`
- Create: `apps/web/src/components/panel/EditorPanelContent.tsx`

（各コンポーネントは既存のコンポーネントをラップする単純な実装）

**Step 1: 各コンテンツ実装**

```typescript
// AgentPanel.tsx
import type { Agent } from "../../types";
import { AIWorkflowPanel } from "../AIWorkflowPanel";

interface AgentPanelProps {
  agent: Agent;
}

export function AgentPanel({ agent }: AgentPanelProps) {
  // TODO: agentごとのコンテンツを表示
  return <div className="agent-panel-content">Agent: {agent.name}</div>;
}

// WorkspacePanel.tsx
import type { Workspace } from "../../types";
import { FileTree } from "../FileTree";

interface WorkspacePanelProps {
  workspace: Workspace;
}

export function WorkspacePanel({ workspace }: WorkspacePanelProps) {
  // TODO: workspaceのファイルツリーを表示
  return <div className="workspace-panel-content">Workspace: {workspace.path}</div>;
}

// DeckPanel.tsx
import type { Deck } from "../../types";
import { TerminalPane } from "../TerminalPane";

interface DeckPanelProps {
  deck: Deck;
}

export function DeckPanel({ deck }: DeckPanelProps) {
  // TODO: deckのターミナルを表示
  return <div className="deck-panel-content">Deck: {deck.name}</div>;
}

// TerminalPanelContent.tsx
import type { Terminal } from "../../types";

interface TerminalPanelContentProps {
  terminal: Terminal;
}

export function TerminalPanelContent({ terminal }: TerminalPanelContentProps) {
  // TODO: xterm.jsでターミナルを表示
  return <div className="terminal-panel-content">Terminal: {terminal.command}</div>;
}

// EditorPanelContent.tsx
import Editor from "@monaco-editor/react";
import type { EditorFile } from "../../types";
import { EDITOR_FONT_FAMILY, EDITOR_FONT_SIZE } from "../../constants";

interface EditorPanelContentProps {
  file: EditorFile;
}

export function EditorPanelContent({ file }: EditorPanelContentProps) {
  return (
    <Editor
      height="100%"
      width="100%"
      theme="vs-dark"
      language={file.language}
      value={file.contents}
      options={{
        fontFamily: EDITOR_FONT_FAMILY,
        fontSize: EDITOR_FONT_SIZE,
        minimap: { enabled: false },
        automaticLayout: true,
      }}
    />
  );
}
```

**Step 2: コミット**

```bash
git add apps/web/src/components/panel/
git commit -m "feat: add panel content components"
```

---

### Task 9: App.tsx統合

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: AppStateに統合パネルステートを追加**

```typescript
interface AppState {
  // 新規: 統合パネル
  panelGroups: PanelGroup[];
  panelLayout: PanelLayout;
  focusedPanelId: string | null;

  // 既存の状態は保持
  // ...
}
```

**Step 2: ハンドラーを追加**

```typescript
// パネル操作ハンドラー
const handleAddTabToPanel = useCallback((tab: UnifiedTab, groupId?: string) => {
  // 既存のパネルにタブを追加
}, []);

const handleCloseTab = useCallback((groupId: string, tabId: string) => {
  // タブを閉じる
}, []);

const handleSplitPanel = useCallback((groupId: string, direction: 'horizontal' | 'vertical') => {
  // パネルを分割
}, []);
```

**Step 3: レンダリングを更新**

```tsx
// 既存のworkspaceViewを置き換え
const unifiedPanelView = (
  <UnifiedPanelView
    groups={panelGroups}
    layout={panelLayout}
    onSelectTab={handleSelectTab}
    onCloseTab={handleCloseTab}
    onFocusGroup={handleFocusGroup}
  />
);
```

**Step 4: コミット**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: integrate unified panel system into App"
```

---

## テスト

### Task 10: テスト実装

**Files:**
- Create: `apps/web/src/__tests__/components/panel.test.tsx`

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

describe("Unified Panel System", () => {
  it("renders empty panel", () => {
    // TODO: 実装
  });

  it("adds tab to panel", () => {
    // TODO: 実装
  });

  it("closes tab from panel", () => {
    // TODO: 実装
  });

  it("splits panel horizontally", () => {
    // TODO: 実装
  });
});
```

---

## まとめ

### 実装順序

1. 型定義拡張
2. 変換ユーティリティ
3. PanelTabList
4. PanelContent
5. UnifiedPanelContainer
6. UnifiedPanelView
7. スタイル追加
8. 各パネルコンテンツ
9. App.tsx統合
10. テスト

### 次のステップ

- タイトルバーからのパネル管理UI
- パネル間のドラッグ&ドロップ
- リサイズ機能
