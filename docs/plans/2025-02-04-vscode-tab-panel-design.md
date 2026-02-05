# VSCodeスタイル タブパネル管理システム 設計書

**日付:** 2025-02-04
**ステータス:** Design
**作成者:** Claude Code

## 概要

VSCodeのタブパネル管理システムをS-IDEのエディタに導入する設計。

### 対象範囲

- **対象:** エディタタブ（EditorPane）
- **優先機能:**
  1. ドラッグ並べ替え
  2. エディタグループ分割

## アーキテクチャ

### コンポーネント構造

```
EditorPane (ルート)
├── EditorGroupContainer
│   ├── EditorTabList (タブバー + ドラッグ並べ替え)
│   ├── EditorBreadcrumb (パンくずリスト)
│   ├── EditorContent (Monacoエディタ)
│   └── EditorStatusBar
└── (複数グループ対応時の分割レイアウト)
```

### 型定義

```typescript
// エディタグループ
interface EditorGroup {
  id: string;
  tabs: EditorFile[];
  activeTabId: string | null;
  focused: boolean;
}

// グループレイアウト
interface GroupLayout {
  groups: EditorGroup[];
  direction: 'horizontal' | 'vertical' | 'single';
  sizes: number[];
}

// タブドラッグデータ
interface DragTabData {
  tabId: string;
  sourceGroupId: string;
}
```

## コンポーネント詳細

### 1. EditorTabList

ドラッグ並べ替え機能付きタブリスト。

**使用ライブラリ:** `@dnd-kit/core`, `@dnd-kit/sortable`

```typescript
interface EditorTabListProps {
  tabs: EditorFile[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabsReorder: (tabs: EditorFile[]) => void;
}
```

**機能:**
- タブのクリックで選択
- 中クリック/×ボタンで閉じる
- ドラッグで並べ替え
- dirtyマーク表示
- 保存中のアニメーション

### 2. EditorGroupContainer

単一のエディタグループを表すコンテナ。

```typescript
interface EditorGroupContainerProps {
  group: EditorGroup;
  isActive: boolean;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabsReorder: (tabs: EditorFile[]) => void;
  onFocus: () => void;
  onDropTab: (tabId: string, fromGroupId: string) => void;
}
```

**機能:**
- タブバーの表示
- Monacoエディタのレンダリング
- ドロップ受け入れ
- フォーカス状態の表示
- 空状態の表示

### 3. EditorPane

ルートコンポーネント。グループレイアウトを管理。

```typescript
interface EditorPaneProps {
  // 既存
  files: EditorFile[];
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
  onChangeFile: (fileId: string, contents: string) => void;
  onSaveFile?: (fileId: string) => void;
  savingFileId: string | null;

  // 新規追加
  editorGroups: EditorGroup[];
  groupLayout: GroupLayout;
  onSplitGroup: (groupId: string, direction: 'horizontal' | 'vertical') => void;
  onCloseGroup: (groupId: string) => void;
  onResizeGroups: (sizes: number[]) => void;
  onFocusGroup: (groupId: string) => void;
  onMoveTabToGroup: (tabId: string, fromGroupId: string, toGroupId: string) => void;
}
```

## ステート管理

### WorkspaceContext拡張

```typescript
interface WorkspaceState {
  // 既存
  files: EditorFile[];
  activeFileId: string | null;
  tree: FileTreeEntry[];
  treeLoading: boolean;
  treeError: string | null;

  // 新規追加
  editorGroups: EditorGroup[];
  focusedGroupId: string | null;
  groupLayout: GroupLayout;
}
```

### アクション

```typescript
interface EditorActions {
  // グループ操作
  splitGroup: (groupId: string, direction: 'horizontal' | 'vertical') => void;
  closeGroup: (groupId: string) => void;
  focusGroup: (groupId: string) => void;

  // タブ操作
  moveTabToGroup: (tabId: string, fromGroupId: string, toGroupId: string) => void;
  duplicateTabInGroup: (tabId: string, targetGroupId: string) => void;
  reorderTabsInGroup: (groupId: string, tabs: EditorFile[]) => void;

  // サイズ変更
  resizeGroups: (sizes: number[]) => void;
}
```

## データフロー

### 並べ替えフロー

```
1. ユーザーがタブをドラッグ開始
2. @dnd-kit が onDragEnd イベント発火
3. EditorTabList が新しい順序を計算
4. onTabsReorder コールバック実行
5. App.tsx → updateWorkspaceState で状態更新
6. EditorPane に再レンダリング
```

### グループ分割フロー

```
1. ユーザーが「分割」ボタン操作
2. 現在のグループからアクティブタブを取得
3. 新しい EditorGroup を作成
4. groupLayout を更新（single → horizontal/vertical）
5. sizes を初期化（例: [50, 50]）
6. 各グループの focused 状態を更新
```

### タブ移動フロー

```
1. ユーザーがタブを別グループにドラッグ
2. EditorGroupContainer の useDroppable がドロップ検知
3. onMoveTabToGroup コールバック実行
4. sourceGroupId からタブを削除
5. targetGroupId にタブを追加
6. 必要に応じて activeTabId を更新
```

## エラーハンドリング

### エッジケース

| ケース | 挙動 | 実装 |
|--------|------|------|
| 最後のタブを閉じる | 空のウェルカム画面 | tabs.length === 0 の分岐 |
| 最後のグループを閉じる | 閉じるボタンを無効化 | groups.length === 1 の条件 |
| 最大分割数 | 最大3グループ | 分割ボタンの条件レンダリング |
| 最小幅制限 | 各グループ150px以上 | リサイザーで制限 |

### エラー回復

```typescript
// 状態整合性チェック
function validateEditorGroups(groups: EditorGroup[]): EditorGroup[] {
  return groups.filter(group => {
    // 無効なタブを削除
    group.tabs = group.tabs.filter(tab => tab.id && tab.path);

    // activeTabId が有効かチェック
    if (group.activeTabId && !group.tabs.find(t => t.id === group.activeTabId)) {
      group.activeTabId = group.tabs[0]?.id ?? null;
    }

    return true;
  });
}
```

## パフォーマンス

### 課題

複数のMonacoエディタを同時にレンダリングすると重い

### 対策

```typescript
// フォーカスされていないグループのエディタは遅延レンダリング
const shouldRenderEditor = (group: EditorGroup, focusedGroupId: string | null) => {
  return group.id === focusedGroupId || group.tabs.length > 0;
};
```

## UI/UX

### タブバー

- アクティブタブ: 背景色強調
- dirty: ●マーク
- 保存中: スピナーアイコン
- ホバー: ×ボタン表示

### グループ境界

- フォーカス済み: 上部境界線強調
- 非フォーカス: 薄い境界線
- リサイザー: ドラッグ可能なバー

### キーボードショートカット

| ショートカット | 機能 |
|----------------|------|
| Ctrl+K, Ctrl+ \ | 水平分割 |
| Ctrl+K, Ctrl+ - | 垂直分割 |
| Ctrl+Tab | 次のタブ |
| Ctrl+Shift+Tab | 前のタブ |

## テスト計画

### ユニットテスト

- EditorTabList: レンダリング、ドラッグ、クリック
- EditorGroupContainer: ドロップ受け入れ、フォーカス
- EditorPane: グループ分割、サイズ変更

### 統合テスト

- 単一グループから水平分割
- タブを別グループにドラッグ移動

### E2Eテスト

- エディタタブの並べ替え
- グループ分割とリサイズ

## 実装タスク

1. 依存ライブラリの追加（@dnd-kit）
2. 型定義の拡張
3. EditorTabList コンポーネント実装
4. EditorGroupContainer コンポーネント実装
5. EditorPane リファクタリング
6. WorkspaceContext 拡張
7. アクションハンドラー実装
8. スタイル追加
9. テスト実装
10. E2Eテスト追加

## 関連ファイル

- `apps/web/src/components/EditorPane.tsx` - 既存のエディタペイン
- `apps/web/src/contexts/WorkspaceContext.tsx` - 拡張対象
- `apps/web/src/types.ts` - 型定義追加
