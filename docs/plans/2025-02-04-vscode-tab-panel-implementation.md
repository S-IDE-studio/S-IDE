# VSCodeスタイル タブパネル管理システム 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** S-IDEのエディタにVSCodeスタイルのタブ管理機能（ドラッグ並べ替え + エディタグループ分割）を実装する

**Architecture:** React Contextでエディタグループ状態を管理し、@dnd-kitでドラッグ&ドロップを実装。EditorPaneをリファクタリングして複数グループ対応にする。

**Tech Stack:** React 18, TypeScript, @dnd-kit/core, @dnd-kit/sortable, Monaco Editor, Vitest

---

## 事前準備

### Task 0: 依存ライブラリの追加

**Files:**
- Modify: `apps/web/package.json`

**Step 1: 依存関係を追加**

```bash
cd apps/web
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: 追加を確認**

```bash
grep -A5 "@dnd-kit" package.json
```

Expected: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` がdependenciesに含まれる

**Step 3: コミット**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "chore: add @dnd-kit for drag and drop support"
```

---

## フェーズ1: 型定義の拡張

### Task 1: エディタグループ関連の型定義追加

**Files:**
- Modify: `apps/web/src/types.ts`

**Step 1: 型定義を追加**

`apps/web/src/types.ts` の末尾（SidebarPanel型の後）に以下を追加:

```typescript
// Editor Groups for VSCode-style tab management
export interface EditorGroup {
  id: string;
  tabs: EditorFile[];
  activeTabId: string | null;
  focused: boolean;
  percentage: number; // Split size percentage (for resize)
}

export interface GroupLayout {
  direction: 'horizontal' | 'vertical' | 'single';
  sizes: number[]; // Size percentages for each group
}

export interface DragTabData {
  tabId: string;
  sourceGroupId: string;
}

// Editor group actions
export interface EditorGroupActions {
  splitGroup: (groupId: string, direction: 'horizontal' | 'vertical') => void;
  closeGroup: (groupId: string) => void;
  focusGroup: (groupId: string) => void;
  moveTabToGroup: (tabId: string, fromGroupId: string, toGroupId: string) => void;
  duplicateTabInGroup: (tabId: string, targetGroupId: string) => void;
  reorderTabsInGroup: (groupId: string, tabs: EditorFile[]) => void;
  resizeGroups: (sizes: number[]) => void;
}
```

**Step 2: 型チェック実行**

```bash
cd apps/web
pnpm run type-check
```

Expected: PASS (型定義追加のみなのでエラーなし)

**Step 3: コミット**

```bash
git add apps/web/src/types.ts
git commit -m "feat: add editor group types for VSCode-style tab management"
```

---

### Task 2: WorkspaceState型拡張

**Files:**
- Modify: `packages/shared/types.ts`

**Step 1: 既存のWorkspaceState型を確認**

```bash
grep -A10 "interface WorkspaceState" packages/shared/types.ts
```

Expected: 現在のWorkspaceState定義が表示される

**Step 2: WorkspaceStateを拡張**

`packages/shared/types.ts` の `interface WorkspaceState` に以下のフィールドを追加:

```typescript
interface WorkspaceState {
  // 既存のフィールド（files, activeFileId, tree など）はそのまま

  // 新規追加: エディタグループ管理
  editorGroups?: EditorGroup[];
  focusedGroupId?: string | null;
  groupLayout?: GroupLayout;
}
```

**Step 3: 型チェック実行**

```bash
pnpm run type-check
```

Expected: PASS

**Step 4: sharedパッケージをビルド**

```bash
pnpm -F @side-ide/shared run build
```

Expected: ビルド成功

**Step 5: コミット**

```bash
git add packages/shared/types.ts
git commit -m "feat: extend WorkspaceState with editor group fields"
```

---

### Task 3: ユーティリティ関数の追加

**Files:**
- Create: `apps/web/src/utils/editorGroupUtils.ts`

**Step 1: ユーティリティ関数を作成**

```typescript
import type { EditorFile, EditorGroup, GroupLayout } from "../types";

/**
 * Generate unique ID for editor groups
 */
export function generateGroupId(): string {
  return `editor-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new editor group
 */
export function createEditorGroup(
  initialTabs: EditorFile[] = [],
  percentage: number = 100
): EditorGroup {
  return {
    id: generateGroupId(),
    tabs: [...initialTabs],
    activeTabId: initialTabs[0]?.id ?? null,
    focused: true,
    percentage,
  };
}

/**
 * Create initial group layout for single group
 */
export function createSingleGroupLayout(initialTabs: EditorFile[] = []): {
  groups: EditorGroup[];
  layout: GroupLayout;
} {
  const group = createEditorGroup(initialTabs, 100);
  return {
    groups: [group],
    layout: {
      direction: "single",
      sizes: [100],
    },
  };
}

/**
 * Validate editor groups (remove invalid tabs, fix activeTabId)
 */
export function validateEditorGroups(groups: EditorGroup[]): EditorGroup[] {
  return groups
    .map((group) => {
      // Remove invalid tabs
      const validTabs = group.tabs.filter((tab) => tab.id && tab.path);

      // Fix activeTabId if invalid
      const activeTabId = validTabs.find((t) => t.id === group.activeTabId)
        ? group.activeTabId
        : validTabs[0]?.id ?? null;

      return {
        ...group,
        tabs: validTabs,
        activeTabId,
      };
    })
    .filter((group) => group.tabs.length > 0 || group.id === "primary");
}

/**
 * Find group containing a specific tab
 */
export function findGroupByTabId(
  groups: EditorGroup[],
  tabId: string
): EditorGroup | null {
  return groups.find((group) => group.tabs.some((tab) => tab.id === tabId)) ?? null;
}

/**
 * Move tab from one group to another
 */
export function moveTabBetweenGroups(
  groups: EditorGroup[],
  tabId: string,
  fromGroupId: string,
  toGroupId: string,
  index?: number
): EditorGroup[] {
  return groups.map((group) => {
    if (group.id === fromGroupId) {
      // Remove tab from source group
      const newTabs = group.tabs.filter((tab) => tab.id !== tabId);
      const activeTabId =
        group.activeTabId === tabId ? newTabs[0]?.id ?? null : group.activeTabId;
      return { ...group, tabs: newTabs, activeTabId };
    } else if (group.id === toGroupId) {
      // Add tab to target group
      const sourceTab = groups
        .find((g) => g.id === fromGroupId)
        ?.tabs.find((t) => t.id === tabId);
      if (!sourceTab) return group;

      const newTabs = [...group.tabs];
      const targetIndex = index ?? newTabs.length;
      newTabs.splice(targetIndex, 0, sourceTab);

      return {
        ...group,
        tabs: newTabs,
        activeTabId: tabId, // Focus the moved tab
        focused: true,
      };
    }
    return group;
  });
}

/**
 * Reorder tabs within a group
 */
export function reorderTabsInGroup(
  groups: EditorGroup[],
  groupId: string,
  newTabs: EditorFile[]
): EditorGroup[] {
  return groups.map((group) =>
    group.id === groupId ? { ...group, tabs: newTabs } : group
  );
}
```

**Step 2: 型チェック実行**

```bash
cd apps/web
pnpm run type-check
```

Expected: PASS

**Step 3: テストファイル作成**

Create: `apps/web/src/__tests__/utils/editorGroupUtils.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import type { EditorFile } from "../../types";
import {
  generateGroupId,
  createEditorGroup,
  createSingleGroupLayout,
  validateEditorGroups,
  findGroupByTabId,
  moveTabBetweenGroups,
  reorderTabsInGroup,
} from "../../utils/editorGroupUtils";

describe("editorGroupUtils", () => {
  const mockFile: EditorFile = {
    id: "file-1",
    name: "test.ts",
    path: "/path/to/test.ts",
    language: "typescript",
    contents: "test content",
  };

  describe("generateGroupId", () => {
    it("generates unique IDs", () => {
      const id1 = generateGroupId();
      const id2 = generateGroupId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^editor-group-/);
    });
  });

  describe("createEditorGroup", () => {
    it("creates group with initial tabs", () => {
      const group = createEditorGroup([mockFile], 50);
      expect(group.tabs).toEqual([mockFile]);
      expect(group.activeTabId).toBe("file-1");
      expect(group.percentage).toBe(50);
      expect(group.focused).toBe(true);
    });

    it("creates empty group", () => {
      const group = createEditorGroup([], 100);
      expect(group.tabs).toEqual([]);
      expect(group.activeTabId).toBeNull();
    });
  });

  describe("createSingleGroupLayout", () => {
    it("creates single group layout", () => {
      const { groups, layout } = createSingleGroupLayout([mockFile]);
      expect(groups).toHaveLength(1);
      expect(groups[0].tabs).toEqual([mockFile]);
      expect(layout.direction).toBe("single");
      expect(layout.sizes).toEqual([100]);
    });
  });

  describe("validateEditorGroups", () => {
    it("removes invalid tabs", () => {
      const group = createEditorGroup([mockFile]);
      group.tabs.push({} as EditorFile); // Invalid tab
      const validated = validateEditorGroups([group]);
      expect(validated[0].tabs).toHaveLength(1);
    });

    it("fixes invalid activeTabId", () => {
      const group = createEditorGroup([mockFile]);
      group.activeTabId = "invalid-id";
      const validated = validateEditorGroups([group]);
      expect(validated[0].activeTabId).toBe("file-1");
    });
  });

  describe("findGroupByTabId", () => {
    it("finds group containing tab", () => {
      const group = createEditorGroup([mockFile]);
      const found = findGroupByTabId([group], "file-1");
      expect(found).toBe(group);
    });

    it("returns null if tab not found", () => {
      const group = createEditorGroup([mockFile]);
      const found = findGroupByTabId([group], "invalid");
      expect(found).toBeNull();
    });
  });

  describe("moveTabBetweenGroups", () => {
    it("moves tab from one group to another", () => {
      const file2: EditorFile = { ...mockFile, id: "file-2", name: "test2.ts" };
      const group1 = createEditorGroup([mockFile, file2]);
      const group2 = createEditorGroup([]);

      const result = moveTabBetweenGroups([group1, group2], "file-1", group1.id, group2.id);

      expect(result[0].tabs).toHaveLength(1);
      expect(result[0].tabs[0].id).toBe("file-2");
      expect(result[1].tabs).toHaveLength(1);
      expect(result[1].tabs[0].id).toBe("file-1");
    });
  });

  describe("reorderTabsInGroup", () => {
    it("reorders tabs in group", () => {
      const file2: EditorFile = { ...mockFile, id: "file-2", name: "test2.ts" };
      const file3: EditorFile = { ...mockFile, id: "file-3", name: "test3.ts" };
      const group = createEditorGroup([mockFile, file2, file3]);

      const reordered = [file2, file3, mockFile];
      const result = reorderTabsInGroup([group], group.id, reordered);

      expect(result[0].tabs).toEqual(reordered);
    });
  });
});
```

**Step 4: テスト実行**

```bash
cd apps/web
pnpm test utils/editorGroupUtils.test.ts
```

Expected: PASS

**Step 5: コミット**

```bash
git add apps/web/src/utils/editorGroupUtils.ts apps/web/src/__tests__/utils/editorGroupUtils.test.ts
git commit -m "feat: add editor group utility functions with tests"
```

---

## フェーズ2: EditorTabList コンポーネント（ドラッグ並べ替え）

### Task 4: EditorTabList コンポーネント実装

**Files:**
- Create: `apps/web/src/components/editor/EditorTabList.tsx`

**Step 1: テスト用のモックを準備**

まず、`@dnd-kit` のモックを設定

Create: `apps/web/src/__tests__/mocks/dnd-kit.ts`

```typescript
export const mockDndContext = ({ children }: { children: React.ReactNode }) => children;

export const mockSortableContext = ({ children }: { children: React.ReactNode }) => children;

export const mockUseSortable = () => ({
  attributes: {},
  listeners: {},
  setNodeRef: () => {},
  transform: null,
  transition: undefined,
  isDragging: false,
});

export const useDroppable = mockUseSortable;
export const useDragOverlay = () => ({ active: null });

// Re-export mocks
export { mockDndContext as DndContext, mockSortableContext as SortableContext };
```

**Step 2: EditorTabListコンポーネントを作成**

Create: `apps/web/src/components/editor/EditorTabList.tsx`

```typescript
import { X, Loader2, Pin } from "lucide-react";
import { memo, useCallback } from "react";
import type { EditorFile } from "../../types";
import { getFileIcon } from "../EditorPane";

interface EditorTabListProps {
  tabs: EditorFile[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  savingFileId: string | null;
  isDraggable?: boolean; // 後でドラッグ機能を有効化
}

// Empty tab list component
export function EditorTabList({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  savingFileId,
  isDraggable = false, // TODO: フェーズ3で有効化
}: EditorTabListProps) {
  const handleCloseTab = useCallback(
    (e: React.MouseEvent, fileId: string) => {
      e.stopPropagation();
      onTabClose(fileId);
    },
    [onTabClose]
  );

  const handleTabMiddleClick = useCallback(
    (e: React.MouseEvent, fileId: string) => {
      if (e.button === 1) {
        e.preventDefault();
        onTabClose(fileId);
      }
    },
    [onTabClose]
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="editor-tabs">
      <div className="editor-tabs-list" role="tablist">
        {tabs.map((file) => {
          const { icon, color } = getFileIcon(file.name);
          const isActive = file.id === activeFileId;
          const isSaving = savingFileId === file.id;

          return (
            <div
              key={file.id}
              className={`editor-tab ${isActive ? "active" : ""} ${file.dirty ? "dirty" : ""}`}
              onClick={() => onTabSelect(file.id)}
              onMouseDown={(e) => handleTabMiddleClick(e, file.id)}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
            >
              <span className="editor-tab-icon" style={{ color }}>
                {icon}
              </span>
              <span className="editor-tab-name">{file.name}</span>
              {file.dirty && !isSaving && (
                <span className="editor-tab-dirty" aria-label="未保存">
                  ●
                </span>
              )}
              {isSaving && (
                <span className="editor-tab-saving" aria-label="保存中">
                  <Loader2 size={14} className="spin" />
                </span>
              )}
              <button
                type="button"
                className="editor-tab-close"
                onClick={(e) => handleCloseTab(e, file.id)}
                aria-label="閉じる"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const MemoizedEditorTabList = memo(EditorTabList);
```

**Step 3: 型チェック実行**

```bash
cd apps/web
pnpm run type-check
```

Expected: PASS（EditorPaneから既存の関数を使用）

**Step 4: コミット**

```bash
git add apps/web/src/components/editor/EditorTabList.tsx
git commit -m "feat: add EditorTabList component (without drag-drop yet)"
```

---

## フェーズ3: EditorGroupContainer コンポーネント

### Task 5: EditorGroupContainer コンポーネント実装

**Files:**
- Create: `apps/web/src/components/editor/EditorGroupContainer.tsx`

**Step 1: EditorGroupContainerコンポーネントを作成**

Create: `apps/web/src/components/editor/EditorGroupContainer.tsx`

```typescript
import { File as FileIcon } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { EDITOR_FONT_FAMILY, EDITOR_FONT_SIZE, LABEL_EMPTY } from "../../constants";
import type { EditorGroup } from "../../types";
import { EditorTabList } from "./EditorTabList";

interface EditorGroupContainerProps {
  group: EditorGroup;
  isFocused: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onChangeTab: (tabId: string, contents: string) => void;
  onSaveTab?: (tabId: string) => void;
  savingTabId: string | null;
  onFocus: () => void;
  onTabsReorder?: (tabs: typeof group.tabs) => void; // TODO: フェーズ4で実装
}

const MONACO_THEME = "vs-dark";

export function EditorGroupContainer({
  group,
  isFocused,
  onSelectTab,
  onCloseTab,
  onChangeTab,
  onSaveTab,
  savingTabId,
  onFocus,
}: EditorGroupContainerProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const cursorPositionRef = useRef({ line: 1, column: 1 });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const activeFile = group.tabs.find((tab) => tab.id === group.activeTabId);

  // Delay editor rendering until container has proper dimensions
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
    });
    return () => cancelAnimationFrame(timer);
  }, [group.activeTabId]);

  const handleEditorMount: OnMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          editor.layout();
        } catch {
          // Ignore layout errors during initialization
        }
      });
    });
    resizeObserverRef.current = resizeObserver;
    const container = editor.getContainerDomNode();
    if (container?.parentElement) {
      resizeObserver.observe(container.parentElement);
    }

    editor.onDidChangeCursorPosition((e) => {
      cursorPositionRef.current = {
        line: e.position.lineNumber,
        column: e.position.column,
      };
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeFile) return;
      const isSave = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
      if (!isSave) return;
      event.preventDefault();
      onSaveTab?.(activeFile.id);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFile, onSaveTab]);

  // Focus group on click
  const handleContainerClick = useCallback(() => {
    onFocus();
  }, [onFocus]);

  // Empty state
  if (group.tabs.length === 0) {
    return (
      <div
        className={`editor-group-container ${isFocused ? "focused" : ""}`}
        onClick={handleContainerClick}
      >
        <div className="editor-container editor-empty">
          <div className="editor-welcome">
            <div className="editor-welcome-icon">
              <FileIcon size={48} />
            </div>
            <div className="editor-welcome-text">{LABEL_EMPTY}</div>
            <div className="editor-welcome-hint">ファイルを開いてください</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`editor-group-container ${isFocused ? "focused" : ""}`}
      onClick={handleContainerClick}
    >
      {/* Tab Bar */}
      <EditorTabList
        tabs={group.tabs}
        activeTabId={group.activeTabId}
        onTabSelect={onSelectTab}
        onTabClose={onCloseTab}
        savingFileId={savingTabId}
        isDraggable={false} // TODO: フェーズ4で有効化
      />

      {/* Breadcrumb */}
      {activeFile && (
        <div className="editor-breadcrumb">
          <span className="editor-breadcrumb-path">{activeFile.path}</span>
        </div>
      )}

      {/* Editor Content */}
      <div className="editor-content">
        {activeFile ? (
          <div style={{ height: "100%", width: "100%", overflow: "hidden" }}>
            {isEditorReady ? (
              <Editor
                key={activeFile.id}
                height="100%"
                width="100%"
                theme={MONACO_THEME}
                language={activeFile.language}
                value={activeFile.contents}
                onChange={(value) => onChangeTab(activeFile.id, value ?? "")}
                onMount={handleEditorMount}
                options={{
                  fontFamily: EDITOR_FONT_FAMILY,
                  fontSize: EDITOR_FONT_SIZE,
                  fontLigatures: true,
                  minimap: { enabled: false },
                  smoothScrolling: false,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  renderLineHighlight: "all",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 8, bottom: 8 },
                  lineNumbers: "on",
                  renderWhitespace: "selection",
                  bracketPairColorization: { enabled: true },
                  guides: {
                    bracketPairs: true,
                    indentation: true,
                  },
                  scrollbar: {
                    useShadows: false,
                    vertical: "auto",
                    horizontal: "auto",
                  },
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--ink-muted)",
                }}
              >
                エディターを初期化中...
              </div>
            )}
          </div>
        ) : (
          <div className="editor-no-file">
            <span>{LABEL_EMPTY}</span>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {activeFile && (
        <div className="editor-statusbar">
          <div className="editor-statusbar-left">
            {/* TODO: Git branch info */}
          </div>
          <div className="editor-statusbar-right">
            <span className="editor-status-item">
              Ln {cursorPositionRef.current.line}, Col {cursorPositionRef.current.column}
            </span>
            <span className="editor-status-item">UTF-8</span>
            <span className="editor-status-item">{activeFile.language}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const MemoizedEditorGroupContainer = memo(EditorGroupContainer);
```

**Step 2: 型チェック実行**

```bash
cd apps/web
pnpm run type-check
```

Expected: PASS

**Step 3: コミット**

```bash
git add apps/web/src/components/editor/EditorGroupContainer.tsx
git commit -m "feat: add EditorGroupContainer component"
```

---

## フェーズ4: EditorPane リファクタリング

### Task 6: EditorPaneをマルチグループ対応にリファクタリング

**Files:**
- Modify: `apps/web/src/components/EditorPane.tsx`

**Step 1: 既存のEditorPaneをバックアップ**

```bash
cp apps/web/src/components/EditorPane.tsx apps/web/src/components/EditorPane.tsx.backup
```

**Step 2: EditorPaneを書き換え**

完全に書き換えます:

```typescript
import { memo, useCallback } from "react";
import type { EditorGroup, GroupLayout } from "../types";
import { createSingleGroupLayout } from "../utils/editorGroupUtils";
import { MemoizedEditorGroupContainer } from "./editor/EditorGroupContainer";

interface EditorPaneProps {
  // 既存のprops（後方互換性）
  files: typeof import("../types").EditorFile[];
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
  onChangeFile: (fileId: string, contents: string) => void;
  onSaveFile?: (fileId: string) => void;
  savingFileId: string | null;

  // 新規props（グループ管理）
  editorGroups?: EditorGroup[];
  groupLayout?: GroupLayout;
  onSplitGroup?: (groupId: string, direction: "horizontal" | "vertical") => void;
  onCloseGroup?: (groupId: string) => void;
  onFocusGroup?: (groupId: string) => void;
  onResizeGroups?: (sizes: number[]) => void;
  onMoveTabToGroup?: (tabId: string, fromGroupId: string, toGroupId: string) => void;
  onReorderTabsInGroup?: (groupId: string, tabs: typeof import("../types").EditorFile[]) => void;
}

export function EditorPane({
  files,
  activeFileId,
  onSelectFile,
  onCloseFile,
  onChangeFile,
  onSaveFile,
  savingFileId,
  // 新規props（オプション）
  editorGroups,
  groupLayout,
  onSplitGroup,
  onCloseGroup,
  onFocusGroup,
  onResizeGroups,
  onMoveTabToGroup,
  onReorderTabsInGroup,
}: EditorPaneProps) {
  // 後方互換性: グループ情報がない場合は単一グループを作成
  const groups = editorGroups ?? createSingleGroupLayout(files).groups;
  const layout = groupLayout ?? { direction: "single", sizes: [100] };
  const focusedGroupId = groups.find((g) => g.focused)?.id ?? groups[0]?.id;

  // 既存APIをグループベースのAPIに変換
  const handleSelectTab = useCallback(
    (tabId: string) => {
      onSelectFile(tabId);
    },
    [onSelectFile]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      onCloseFile(tabId);
    },
    [onCloseFile]
  );

  const handleChangeTab = useCallback(
    (tabId: string, contents: string) => {
      onChangeFile(tabId, contents);
    },
    [onChangeFile]
  );

  const handleSaveTab = useCallback(
    (tabId: string) => {
      onSaveFile?.(tabId);
    },
    [onSaveFile]
  );

  const handleFocusGroup = useCallback(
    (groupId: string) => {
      onFocusGroup?.(groupId);
    },
    [onFocusGroup]
  );

  // 単一グループレイアウト（既存のUIと同じ）
  if (layout.direction === "single" || groups.length === 1) {
    const group = groups[0];
    if (!group) {
      return (
        <div className="editor-container editor-empty">
          <div className="editor-welcome">
            <div className="editor-welcome-text">ファイルを選択してください</div>
          </div>
        </div>
      );
    }

    return (
      <MemoizedEditorGroupContainer
        key={group.id}
        group={group}
        isFocused={group.id === focusedGroupId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onChangeTab={handleChangeTab}
        onSaveTab={handleSaveTab}
        savingTabId={savingFileId}
        onFocus={handleFocusGroup}
      />
    );
  }

  // 複数グループレイアウト（TODO: フェーズ5で実装）
  return (
    <div className="editor-groups-container">
      {groups.map((group) => (
        <MemoizedEditorGroupContainer
          key={group.id}
          group={group}
          isFocused={group.id === focusedGroupId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onChangeTab={handleChangeTab}
          onSaveTab={handleSaveTab}
          savingTabId={savingFileId}
          onFocus={handleFocusGroup}
        />
      ))}
    </div>
  );
}

// Memoize for performance
const areEqual = (
  prevProps: EditorPaneProps,
  nextProps: EditorPaneProps
): boolean => {
  return (
    prevProps.files === nextProps.files &&
    prevProps.activeFileId === nextProps.activeFileId &&
    prevProps.savingFileId === nextProps.savingFileId &&
    prevProps.editorGroups === nextProps.editorGroups &&
    prevProps.groupLayout === nextProps.groupLayout
  );
};

export const MemoizedEditorPane = memo(EditorPane, areEqual);
```

**Step 3: 型チェック実行**

```bash
cd apps/web
pnpm run type-check
```

Expected: PASS

**Step 4: 既存のテストが通ることを確認**

```bash
cd apps/web
pnpm test
```

Expected: PASS

**Step 5: コミット**

```bash
git add apps/web/src/components/EditorPane.tsx
git commit -m "refactor: rewrite EditorPane with multi-group support"
```

---

## フェーズ5: ドラッグ&ドロップ実装

### Task 7: EditorTabListにドラッグ&ドロップを追加

**Files:**
- Modify: `apps/web/src/components/editor/EditorTabList.tsx`

**Step 1: EditorTabListにドラッグ機能を追加**

```typescript
import { X, Loader2 } from "lucide-react";
import { memo, useCallback } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { EditorFile } from "../../types";
import { getFileIcon } from "../EditorPane";

interface EditorTabListProps {
  tabs: EditorFile[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  savingFileId: string | null;
  onTabsReorder: (tabs: EditorFile[]) => void;
}

// Sortable Tab Component
interface SortableTabProps {
  file: EditorFile;
  isActive: boolean;
  isSaving: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
}

function SortableTab({ file, isActive, isSaving, onSelect, onClose }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { icon, color } = getFileIcon(file.name);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`editor-tab ${isActive ? "active" : ""} ${file.dirty ? "dirty" : ""}`}
      onClick={onSelect}
      onMouseDown={(e) => {
        // Middle click to close
        if (e.button === 1) {
          e.preventDefault();
          onClose(e);
        }
      }}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      {...attributes}
      {...listeners}
    >
      <span className="editor-tab-icon" style={{ color }}>
        {icon}
      </span>
      <span className="editor-tab-name">{file.name}</span>
      {file.dirty && !isSaving && (
        <span className="editor-tab-dirty" aria-label="未保存">
          ●
        </span>
      )}
      {isSaving && (
        <span className="editor-tab-saving" aria-label="保存中">
          <Loader2 size={14} className="spin" />
        </span>
      )}
      <button
        type="button"
        className="editor-tab-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose(e);
        }}
        aria-label="閉じる"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function EditorTabList({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  savingFileId,
  onTabsReorder,
}: EditorTabListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = tabs.findIndex((tab) => tab.id === active.id);
        const newIndex = tabs.findIndex((tab) => tab.id === over.id);

        const newTabs = [...tabs];
        const [removed] = newTabs.splice(oldIndex, 1);
        newTabs.splice(newIndex, 0, removed);

        onTabsReorder(newTabs);
      }
    },
    [tabs, onTabsReorder]
  );

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, fileId: string) => {
      e.stopPropagation();
      onTabClose(fileId);
    },
    [onTabClose]
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="editor-tabs">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={tabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="editor-tabs-list" role="tablist">
            {tabs.map((file) => {
              const isActive = file.id === activeTabId;
              const isSaving = savingFileId === file.id;

              return (
                <SortableTab
                  key={file.id}
                  file={file}
                  isActive={isActive}
                  isSaving={isSaving}
                  onSelect={() => onTabSelect(file.id)}
                  onClose={(e) => handleCloseTab(e, file.id)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export const MemoizedEditorTabList = memo(EditorTabList);
```

**Step 2: 型チェック実行**

```bash
cd apps/web
pnpm run type-check
```

Expected: PASS

**Step 3: コミット**

```bash
git add apps/web/src/components/editor/EditorTabList.tsx
git commit -m "feat: add drag and drop to EditorTabList"
```

---

## フェーズ6: App.tsx統合

### Task 8: App.tsxでエディタグループ機能を統合

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: App.tsxにエディタグループ用ハンドラーを追加**

既存の `handleCloseFile` などの近くに以下を追加:

```typescript
// In App component, add new handlers after existing file operations

// Editor group handlers
const handleSplitGroup = useCallback(
  (groupId: string, direction: "horizontal" | "vertical") => {
    if (!editorWorkspaceId) return;

    updateWorkspaceState(editorWorkspaceId, (state) => {
      const currentGroups = state.editorGroups || createSingleGroupLayout(state.files).groups;
      const currentLayout = state.groupLayout || { direction: "single", sizes: [100] };

      // Find the group to split
      const groupIndex = currentGroups.findIndex((g) => g.id === groupId);
      if (groupIndex === -1) return state;

      // Maximum 3 groups
      if (currentGroups.length >= 3) return state;

      const sourceGroup = currentGroups[groupIndex];
      const activeTab = sourceGroup.tabs.find((t) => t.id === sourceGroup.activeTabId);

      // Create new group with the active tab
      const { generateGroupId, createEditorGroup } = await import("../utils/editorGroupUtils");
      const newGroup = createEditorGroup(activeTab ? [activeTab] : [], 50);

      // Insert new group
      const newGroups = [...currentGroups];
      newGroups.splice(groupIndex + 1, 0, newGroup);

      // Update layout
      const newLayout: GroupLayout = {
        direction: currentGroups.length === 1 ? direction : currentLayout.direction,
        sizes: [...currentLayout.sizes.slice(0, groupIndex + 1), 50].map((s) => s / 2),
      };

      return {
        ...state,
        editorGroups: newGroups,
        groupLayout: newLayout,
        focusedGroupId: newGroup.id,
      };
    });
  },
  [editorWorkspaceId, updateWorkspaceState]
);

const handleCloseGroup = useCallback(
  (groupId: string) => {
    if (!editorWorkspaceId) return;

    updateWorkspaceState(editorWorkspaceId, (state) => {
      const currentGroups = state.editorGroups || createSingleGroupLayout(state.files).groups;

      // Don't allow closing the last group
      if (currentGroups.length <= 1) return state;

      const newGroups = currentGroups.filter((g) => g.id !== groupId);
      const closedGroup = currentGroups.find((g) => g.id === groupId);

      // Move tabs from closed group to remaining groups
      if (closedGroup && closedGroup.tabs.length > 0) {
        // Add to first remaining group
        newGroups[0].tabs.push(...closedGroup.tabs);
        if (!newGroups[0].activeTabId) {
          newGroups[0].activeTabId = closedGroup.activeTabId;
        }
      }

      return {
        ...state,
        editorGroups: newGroups,
        focusedGroupId: newGroups[0].id,
      };
    });
  },
  [editorWorkspaceId, updateWorkspaceState]
);

const handleFocusGroup = useCallback(
  (groupId: string) => {
    if (!editorWorkspaceId) return;

    updateWorkspaceState(editorWorkspaceId, (state) => {
      const currentGroups = state.editorGroups || createSingleGroupLayout(state.files).groups;
      return {
        ...state,
        editorGroups: currentGroups.map((g) => ({
          ...g,
          focused: g.id === groupId,
        })),
        focusedGroupId: groupId,
      };
    });
  },
  [editorWorkspaceId, updateWorkspaceState]
);

const handleReorderTabsInGroup = useCallback(
  (groupId: string, tabs: EditorFile[]) => {
    if (!editorWorkspaceId) return;

    updateWorkspaceState(editorWorkspaceId, (state) => {
      const currentGroups = state.editorGroups || createSingleGroupLayout(state.files).groups;
      return {
        ...state,
        editorGroups: currentGroups.map((g) =>
          g.id === groupId ? { ...g, tabs } : g
        ),
      };
    });
  },
  [editorWorkspaceId, updateWorkspaceState]
);
```

**Step 2: EditorPane呼び出しを更新**

EditorPaneを使用している箇所（630行目付近）を更新:

```typescript
<EditorPane
  files={activeWorkspaceState.files}
  activeFileId={activeWorkspaceState.activeFileId}
  onSelectFile={(fileId) => {
    if (!editorWorkspaceId) return;
    updateWorkspaceState(editorWorkspaceId, (state) => ({
      ...state,
      activeFileId: fileId,
    }));
  }}
  onCloseFile={handleCloseFile}
  onChangeFile={handleFileChange}
  onSaveFile={handleSaveFile}
  savingFileId={savingFileId}
  // 新規props
  editorGroups={activeWorkspaceState.editorGroups}
  groupLayout={activeWorkspaceState.groupLayout}
  onSplitGroup={handleSplitGroup}
  onCloseGroup={handleCloseGroup}
  onFocusGroup={handleFocusGroup}
  onReorderTabsInGroup={handleReorderTabsInGroup}
/>
```

**Step 3: 型チェック実行**

```bash
cd apps/web
pnpm run type-check
```

Expected: PASS

**Step 4: アプリケーション起動テスト**

```bash
cd apps/web
pnpm run dev
```

Expected: アプリケーションが起動し、既存の機能が動作する

**Step 5: コミット**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: integrate editor group management into App"
```

---

## フェーズ7: スタイル追加

### Task 9: エディタグループ用スタイル追加

**Files:**
- Modify: `apps/web/src/styles.css`

**Step 1: スタイルを追加**

`apps/web/src/styles.css` の末尾に追加:

```css
/* Editor Groups Container */
.editor-groups-container {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.editor-groups-container.vertical {
  flex-direction: column;
}

/* Editor Group Container */
.editor-group-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  border: 1px solid transparent;
  transition: border-color 0.15s ease;
  position: relative;
}

.editor-group-container.focused {
  border-top-color: var(--accent-primary, #007acc);
  border-top-width: 2px;
}

.editor-group-container:hover {
  background-color: var(--layer-1, rgba(255, 255, 255, 0.03));
}

/* Group Resizer */
.group-resizer {
  background-color: var(--border, #3c3c3c);
  flex-shrink: 0;
  transition: background-color 0.15s ease;
  z-index: 10;
}

.group-resizer.horizontal {
  width: 4px;
  cursor: ew-resize;
}

.group-resizer.vertical {
  height: 4px;
  cursor: ns-resize;
}

.group-resizer:hover,
.group-resizer.dragging {
  background-color: var(--accent-primary, #007acc);
}

/* Dragging states */
.editor-tab.dragging {
  opacity: 0.5;
}

.editor-tabs-list.drag-over {
  background-color: rgba(0, 122, 204, 0.1);
}

/* Group split button (context menu/action bar) */
.group-split-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--border, #3c3c3c);
  border-radius: 4px;
  color: var(--ink, #cccccc);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.group-split-button:hover {
  background-color: var(--layer-2, rgba(255, 255, 255, 0.08));
  border-color: var(--ink, #cccccc);
}

.group-close-button {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.editor-group-container:hover .group-close-button {
  opacity: 1;
}
```

**Step 2: 既存のエディタスタイルを調整**

既存の `.editor-tabs`, `.editor-tab` などのスタイルが新しい構造に合うことを確認

**Step 3: コミット**

```bash
git add apps/web/src/styles.css
git commit -m "style: add editor group styles"
```

---

## フェーズ8: テスト実装

### Task 10: エディタグループ機能のテスト実装

**Files:**
- Create: `apps/web/src/__tests__/components/editorGroup.test.tsx`

**Step 1: テストファイル作成**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EditorPane } from "../../components/EditorPane";
import type { EditorFile, EditorGroup } from "../../types";

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => ({
  default: () => null,
  __monaco_editor_react__: true,
}));

// Mock @dnd-kit
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: (fn: unknown) => fn,
  useSensors: () => [],
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => "",
    },
  },
}));

describe("EditorPane with Groups", () => {
  const mockFile: EditorFile = {
    id: "file-1",
    name: "test.ts",
    path: "/path/to/test.ts",
    language: "typescript",
    contents: "test content",
  };

  const mockFile2: EditorFile = {
    id: "file-2",
    name: "test2.ts",
    path: "/path/to/test2.ts",
    language: "typescript",
    contents: "test content 2",
  };

  const defaultProps = {
    files: [mockFile, mockFile2],
    activeFileId: "file-1",
    onSelectFile: vi.fn(),
    onCloseFile: vi.fn(),
    onChangeFile: vi.fn(),
    onSaveFile: vi.fn(),
    savingFileId: null,
  };

  it("renders single group layout by default", () => {
    render(<EditorPane {...defaultProps} />);

    expect(screen.getByText("test.ts")).toBeInTheDocument();
  });

  it("renders multiple groups when provided", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [mockFile],
        activeTabId: "file-1",
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [mockFile2],
        activeTabId: "file-2",
        focused: false,
        percentage: 50,
      },
    ];

    const { rerender } = render(<EditorPane {...defaultProps} editorGroups={groups} />);

    expect(screen.getByText("test.ts")).toBeInTheDocument();
    expect(screen.getByText("test2.ts")).toBeInTheDocument();
  });

  it("calls onSelectFile when tab is clicked", () => {
    render(<EditorPane {...defaultProps} />);

    const tab = screen.getByText("test.ts");
    fireEvent.click(tab);

    expect(defaultProps.onSelectFile).toHaveBeenCalledWith("file-1");
  });

  it("calls onCloseFile when close button is clicked", () => {
    render(<EditorPane {...defaultProps} />);

    const closeButton = screen.getAllByLabelText("閉じる")[0];
    fireEvent.click(closeButton);

    expect(defaultProps.onCloseFile).toHaveBeenCalledWith("file-1");
  });

  it("shows empty state when no files", () => {
    render(<EditorPane {...defaultProps} files={[]} activeFileId={null} />);

    expect(screen.getByText("ファイルを選択してください")).toBeInTheDocument();
  });
});
```

**Step 2: テスト実行**

```bash
cd apps/web
pnpm test components/editorGroup.test.tsx
```

Expected: PASS

**Step 3: コミット**

```bash
git add apps/web/src/__tests__/components/editorGroup.test.tsx
git commit -m "test: add editor group tests"
```

---

## まとめ

### 完了後の動作確認

**Step 1: アプリケーションビルド**

```bash
pnpm run build
```

**Step 2: 全テスト実行**

```bash
pnpm test
```

**Step 3: 型チェック**

```bash
pnpm run type-check
```

**Step 4: 手動テスト**

1. アプリケーションを起動
2. ファイルを開いてタブが表示されることを確認
3. タブをドラッグして並べ替えができることを確認
4. （オプション）グループ分割機能を確認

### 関連スキル

- @superpowers:systematic-debugging - エラー発生時のデバッグ
- @superpowers:receiving-code-review - コードレビューを受ける際
- @superpowers:test-driven-development - テスト駆動開発

### 次のステップ（オプション）

1. グループ間のタブ移動（ドラッグ&ドロップ）
2. グループリサイザーの実装
3. キーボードショートカット（Ctrl+K Ctrl+\ など）
4. E2Eテスト追加
5. ピン留め機能
