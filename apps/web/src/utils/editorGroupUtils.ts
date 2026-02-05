/**
 * Utility functions for editor group management
 * Supports VSCode-style tab management with drag-and-drop
 */

import type { EditorFile, EditorGroup, GroupLayout } from "../types";

/**
 * Generate unique ID for editor groups
 * @returns Unique group identifier
 */
export function generateGroupId(): string {
  return `editor-group-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a new editor group
 * @param initialTabs - Initial tabs to add to the group
 * @param percentage - Split size percentage (default: 100)
 * @returns New editor group
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
 * @param initialTabs - Initial tabs to add to the group
 * @returns Object with groups array and layout configuration
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
 * @param groups - Editor groups to validate
 * @returns Validated and cleaned editor groups
 */
export function validateEditorGroups(groups: EditorGroup[]): EditorGroup[] {
  return (
    groups
      .map((group) => {
        // Remove invalid tabs (must have both id and path)
        const validTabs = group.tabs.filter((tab) => tab.id && tab.path);

        // Fix activeTabId if invalid or pointing to removed tab
        const activeTabId = validTabs.find((t) => t.id === group.activeTabId)
          ? group.activeTabId
          : (validTabs[0]?.id ?? null);

        return {
          ...group,
          tabs: validTabs,
          activeTabId,
        };
      })
      // Keep groups with tabs or the primary group
      .filter((group) => group.tabs.length > 0 || group.id === "primary")
  );
}

/**
 * Find group containing a specific tab
 * @param groups - Editor groups to search
 * @param tabId - Tab ID to find
 * @returns Group containing the tab, or null if not found
 */
export function findGroupByTabId(groups: EditorGroup[], tabId: string): EditorGroup | null {
  return groups.find((group) => group.tabs.some((tab) => tab.id === tabId)) ?? null;
}

/**
 * Move tab from one group to another
 * @param groups - Editor groups
 * @param tabId - Tab ID to move
 * @param fromGroupId - Source group ID
 * @param toGroupId - Target group ID
 * @param index - Optional target index (default: end of target group)
 * @returns Updated editor groups
 */
export function moveTabBetweenGroups(
  groups: EditorGroup[],
  tabId: string,
  fromGroupId: string,
  toGroupId: string,
  index?: number
): EditorGroup[] {
  // Find the source tab
  const sourceGroup = groups.find((g) => g.id === fromGroupId);
  const sourceTab = sourceGroup?.tabs.find((t) => t.id === tabId);

  if (!sourceTab) {
    // Tab not found, return original groups
    return groups;
  }

  return groups.map((group) => {
    if (group.id === fromGroupId) {
      // Remove tab from source group
      const newTabs = group.tabs.filter((tab) => tab.id !== tabId);
      const activeTabId =
        group.activeTabId === tabId ? (newTabs[0]?.id ?? null) : group.activeTabId;
      return { ...group, tabs: newTabs, activeTabId };
    } else if (group.id === toGroupId) {
      // Add tab to target group
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
 * @param groups - Editor groups
 * @param groupId - Group ID to reorder tabs in
 * @param newTabs - New tab order
 * @returns Updated editor groups
 */
export function reorderTabsInGroup(
  groups: EditorGroup[],
  groupId: string,
  newTabs: EditorFile[]
): EditorGroup[] {
  return groups.map((group) => (group.id === groupId ? { ...group, tabs: newTabs } : group));
}
