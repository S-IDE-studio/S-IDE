/**
 * Unit tests for editor group utility functions
 */

import { describe, expect, it } from "vitest";
import type { EditorFile, EditorGroup } from "../../types";
import {
  createEditorGroup,
  createSingleGroupLayout,
  findGroupByTabId,
  generateGroupId,
  moveTabBetweenGroups,
  reorderTabsInGroup,
  validateEditorGroups,
} from "../../utils/editorGroupUtils";

// Test fixtures
const createMockFile = (id: string, path: string): EditorFile => ({
  id,
  name: path.split("/").pop() ?? path,
  path,
  language: "typescript",
  contents: `// ${path}`,
  dirty: false,
});

const file1 = createMockFile("file-1", "/src/app.ts");
const file2 = createMockFile("file-2", "/src/utils.ts");
const file3 = createMockFile("file-3", "/src/config.ts");

describe("generateGroupId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateGroupId();
    const id2 = generateGroupId();

    expect(id1).toMatch(/^editor-group-\d+-[a-z0-9]+$/);
    expect(id2).toMatch(/^editor-group-\d+-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it("should generate IDs with correct format", () => {
    const id = generateGroupId();
    const parts = id.split("-");
    expect(parts[0]).toBe("editor");
    expect(parts[1]).toBe("group");
    expect(parts[2]).toMatch(/^\d+$/); // Timestamp
    expect(parts[3]).toMatch(/^[a-z0-9]+$/); // Random string
  });
});

describe("createEditorGroup", () => {
  it("should create empty group by default", () => {
    const group = createEditorGroup();

    expect(group.id).toMatch(/^editor-group-/);
    expect(group.tabs).toEqual([]);
    expect(group.activeTabId).toBeNull();
    expect(group.focused).toBe(true);
    expect(group.percentage).toBe(100);
  });

  it("should create group with initial tabs", () => {
    const group = createEditorGroup([file1, file2]);

    expect(group.tabs).toHaveLength(2);
    expect(group.tabs[0]).toEqual(file1);
    expect(group.tabs[1]).toEqual(file2);
    expect(group.activeTabId).toBe(file1.id);
  });

  it("should create group with custom percentage", () => {
    const group = createEditorGroup([file1], 50);

    expect(group.percentage).toBe(50);
  });

  it("should set first tab as active", () => {
    const group = createEditorGroup([file2, file1, file3]);

    expect(group.activeTabId).toBe(file2.id);
  });

  it("should set focused to true by default", () => {
    const group = createEditorGroup();

    expect(group.focused).toBe(true);
  });
});

describe("createSingleGroupLayout", () => {
  it("should create single group layout with no tabs", () => {
    const { groups, layout } = createSingleGroupLayout();

    expect(groups).toHaveLength(1);
    expect(groups[0].tabs).toEqual([]);
    expect(layout.direction).toBe("single");
    expect(layout.sizes).toEqual([100]);
  });

  it("should create single group layout with initial tabs", () => {
    const { groups, layout } = createSingleGroupLayout([file1, file2]);

    expect(groups).toHaveLength(1);
    expect(groups[0].tabs).toHaveLength(2);
    expect(groups[0].activeTabId).toBe(file1.id);
    expect(layout.direction).toBe("single");
    expect(layout.sizes).toEqual([100]);
  });

  it("should set group percentage to 100", () => {
    const { groups } = createSingleGroupLayout([file1]);

    expect(groups[0].percentage).toBe(100);
  });
});

describe("validateEditorGroups", () => {
  it("should keep valid groups unchanged", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1, file2],
        activeTabId: file1.id,
        focused: true,
        percentage: 100,
      },
    ];

    const validated = validateEditorGroups(groups);

    expect(validated).toEqual(groups);
  });

  it("should remove tabs without id or path", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [
          file1,
          {
            id: "",
            path: "/src/invalid.ts",
            name: "invalid.ts",
            language: "typescript",
            contents: "",
            dirty: false,
          },
          {
            id: "file-3",
            path: "",
            name: "invalid.ts",
            language: "typescript",
            contents: "",
            dirty: false,
          },
        ],
        activeTabId: file1.id,
        focused: true,
        percentage: 100,
      },
    ];

    const validated = validateEditorGroups(groups);

    expect(validated[0].tabs).toHaveLength(1);
    expect(validated[0].tabs[0]).toEqual(file1);
  });

  it("should fix activeTabId if pointing to invalid tab", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1, file2],
        activeTabId: "non-existent",
        focused: true,
        percentage: 100,
      },
    ];

    const validated = validateEditorGroups(groups);

    expect(validated[0].activeTabId).toBe(file1.id);
  });

  it("should set activeTabId to null if primary group has no valid tabs", () => {
    const groups: EditorGroup[] = [
      {
        id: "primary",
        tabs: [],
        activeTabId: "some-id",
        focused: true,
        percentage: 100,
      },
    ];

    const validated = validateEditorGroups(groups);

    expect(validated).toHaveLength(1);
    expect(validated[0].id).toBe("primary");
    expect(validated[0].tabs).toHaveLength(0);
    expect(validated[0].activeTabId).toBeNull();
  });

  it("should remove empty groups except primary", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [],
        activeTabId: null,
        focused: false,
        percentage: 50,
      },
    ];

    const validated = validateEditorGroups(groups);

    expect(validated).toHaveLength(1);
    expect(validated[0].id).toBe("group-1");
  });

  it("should keep primary group even if empty", () => {
    const groups: EditorGroup[] = [
      {
        id: "primary",
        tabs: [],
        activeTabId: null,
        focused: true,
        percentage: 100,
      },
    ];

    const validated = validateEditorGroups(groups);

    expect(validated).toHaveLength(1);
    expect(validated[0].id).toBe("primary");
  });

  it("should handle multiple groups", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file2],
        activeTabId: file2.id,
        focused: false,
        percentage: 50,
      },
    ];

    const validated = validateEditorGroups(groups);

    expect(validated).toHaveLength(2);
  });
});

describe("findGroupByTabId", () => {
  it("should find group containing the tab", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1, file2],
        activeTabId: file1.id,
        focused: true,
        percentage: 100,
      },
      {
        id: "group-2",
        tabs: [file3],
        activeTabId: file3.id,
        focused: false,
        percentage: 100,
      },
    ];

    const result = findGroupByTabId(groups, file2.id);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("group-1");
  });

  it("should return null if tab not found", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 100,
      },
    ];

    const result = findGroupByTabId(groups, "non-existent");

    expect(result).toBeNull();
  });

  it("should handle empty groups array", () => {
    const result = findGroupByTabId([], file1.id);

    expect(result).toBeNull();
  });

  it("should find tab in any group", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 33,
      },
      {
        id: "group-2",
        tabs: [file2],
        activeTabId: file2.id,
        focused: false,
        percentage: 33,
      },
      {
        id: "group-3",
        tabs: [file3],
        activeTabId: file3.id,
        focused: false,
        percentage: 34,
      },
    ];

    expect(findGroupByTabId(groups, file1.id)?.id).toBe("group-1");
    expect(findGroupByTabId(groups, file2.id)?.id).toBe("group-2");
    expect(findGroupByTabId(groups, file3.id)?.id).toBe("group-3");
  });
});

describe("moveTabBetweenGroups", () => {
  it("should move tab from one group to another", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1, file2],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file3],
        activeTabId: file3.id,
        focused: false,
        percentage: 50,
      },
    ];

    const result = moveTabBetweenGroups(groups, file2.id, "group-1", "group-2");

    expect(result[0].tabs).toHaveLength(1);
    expect(result[0].tabs[0].id).toBe(file1.id);
    expect(result[1].tabs).toHaveLength(2);
    expect(result[1].tabs[1].id).toBe(file2.id);
  });

  it("should focus moved tab in target group", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file2],
        activeTabId: file2.id,
        focused: false,
        percentage: 50,
      },
    ];

    const result = moveTabBetweenGroups(groups, file1.id, "group-1", "group-2");

    expect(result[1].activeTabId).toBe(file1.id);
    expect(result[1].focused).toBe(true);
  });

  it("should update activeTabId in source group if moved tab was active", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1, file2],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file3],
        activeTabId: file3.id,
        focused: false,
        percentage: 50,
      },
    ];

    const result = moveTabBetweenGroups(groups, file1.id, "group-1", "group-2");

    expect(result[0].activeTabId).toBe(file2.id);
  });

  it("should keep activeTabId in source group if moved tab was not active", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1, file2],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file3],
        activeTabId: file3.id,
        focused: false,
        percentage: 50,
      },
    ];

    const result = moveTabBetweenGroups(groups, file2.id, "group-1", "group-2");

    expect(result[0].activeTabId).toBe(file1.id);
  });

  it("should insert tab at specific index", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file2, file3],
        activeTabId: file2.id,
        focused: false,
        percentage: 50,
      },
    ];

    const result = moveTabBetweenGroups(groups, file1.id, "group-1", "group-2", 1);

    expect(result[1].tabs[0].id).toBe(file2.id);
    expect(result[1].tabs[1].id).toBe(file1.id);
    expect(result[1].tabs[2].id).toBe(file3.id);
  });

  it("should append tab to end if no index specified", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file2, file3],
        activeTabId: file2.id,
        focused: false,
        percentage: 50,
      },
    ];

    const result = moveTabBetweenGroups(groups, file1.id, "group-1", "group-2");

    expect(result[1].tabs).toHaveLength(3);
    expect(result[1].tabs[2].id).toBe(file1.id);
  });

  it("should return original groups if source tab not found", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file2],
        activeTabId: file2.id,
        focused: false,
        percentage: 50,
      },
    ];

    const result = moveTabBetweenGroups(groups, "non-existent", "group-1", "group-2");

    expect(result).toEqual(groups);
  });

  it("should set activeTabId to null if source group becomes empty", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file2],
        activeTabId: file2.id,
        focused: false,
        percentage: 50,
      },
    ];

    const result = moveTabBetweenGroups(groups, file1.id, "group-1", "group-2");

    expect(result[0].tabs).toHaveLength(0);
    expect(result[0].activeTabId).toBeNull();
  });
});

describe("reorderTabsInGroup", () => {
  it("should reorder tabs in specified group", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1, file2, file3],
        activeTabId: file1.id,
        focused: true,
        percentage: 100,
      },
    ];

    const newOrder = [file3, file1, file2];
    const result = reorderTabsInGroup(groups, "group-1", newOrder);

    expect(result[0].tabs).toEqual(newOrder);
  });

  it("should not affect other groups", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1, file2],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file3],
        activeTabId: file3.id,
        focused: false,
        percentage: 50,
      },
    ];

    const newOrder = [file2, file1];
    const result = reorderTabsInGroup(groups, "group-1", newOrder);

    expect(result[1].tabs).toEqual([file3]);
  });

  it("should handle empty tab array", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 100,
      },
    ];

    const result = reorderTabsInGroup(groups, "group-1", []);

    expect(result[0].tabs).toEqual([]);
  });

  it("should return unchanged groups if group ID not found", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 100,
      },
    ];

    const result = reorderTabsInGroup(groups, "non-existent", [file2]);

    expect(result).toEqual(groups);
  });
});

describe("Integration scenarios", () => {
  it("should handle creating and validating groups", () => {
    const group = createEditorGroup([file1, file2]);
    const validated = validateEditorGroups([group]);

    expect(validated[0].tabs).toHaveLength(2);
    expect(validated[0].activeTabId).toBe(file1.id);
  });

  it("should handle full workflow: create, find, move, reorder", () => {
    // Create initial layout
    const { groups } = createSingleGroupLayout([file1, file2, file3]);

    // Find a group by tab
    const foundGroup = findGroupByTabId(groups, file2.id);
    expect(foundGroup).not.toBeNull();

    // Create a new group and move a tab
    const newGroup = createEditorGroup([], 50);
    const groupsWithNew = [...groups, { ...newGroup, percentage: 50 }];
    const afterMove = moveTabBetweenGroups(groupsWithNew, file3.id, groups[0].id, newGroup.id);

    expect(afterMove[0].tabs).toHaveLength(2);
    expect(afterMove[1].tabs).toHaveLength(1);

    // Reorder tabs in first group
    const reordered = reorderTabsInGroup(afterMove, afterMove[0].id, [file2, file1]);

    expect(reordered[0].tabs[0].id).toBe(file2.id);
    expect(reordered[0].tabs[1].id).toBe(file1.id);
  });

  it("should handle edge case: moving all tabs from one group to another", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [file1],
        activeTabId: file1.id,
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [file2],
        activeTabId: file2.id,
        focused: false,
        percentage: 50,
      },
    ];

    const result = moveTabBetweenGroups(groups, file1.id, "group-1", "group-2");

    expect(result[0].tabs).toHaveLength(0);
    expect(result[0].activeTabId).toBeNull();
    expect(result[1].tabs).toHaveLength(2);
  });
});
