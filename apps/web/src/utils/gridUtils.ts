/**
 * Grid utility functions for panel layout management
 * Pure functions for manipulating GridState trees
 *
 * Reference: VSCode's gridview.ts
 * - https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/ui/grid/gridview.ts
 */

import type {
  GridBranchNode,
  GridLeafNode,
  GridLocation,
  GridNode,
  GridOrientation,
  GridState,
  PanelGroup,
  SplitDirection,
} from "../types";
import { isGridBranchNode, isGridLeafNode } from "../types";

/**
 * Default size for new grid leaves (percentage)
 */
const DEFAULT_LEAF_SIZE = 50;

/**
 * Split direction to orientation mapping
 * "up"/"down" -> vertical (stacked vertically)
 * "left"/"right" -> horizontal (side by side)
 */
function directionToOrientation(direction: SplitDirection): GridOrientation {
  return direction === "left" || direction === "right" ? "horizontal" : "vertical";
}

/**
 * Get the orthogonal (perpendicular) orientation
 * @param orientation - Current orientation
 * @returns Orthogonal orientation
 */
export function orthogonal(orientation: GridOrientation): GridOrientation {
  return orientation === "horizontal" ? "vertical" : "horizontal";
}

/**
 * Tail helper - splits location into [rest, lastIndex]
 * Matches VSCode's tail() function from arrays.ts
 * @param location - Grid location array
 * @returns Tuple of [rest of path, last index]
 */
function tail<T>(location: readonly T[]): [T[], T] {
  return [location.slice(0, -1), location[location.length - 1] as T];
}

/**
 * Generate unique ID for grid leaves
 * @returns Unique leaf identifier
 */
export function generateGridLeafId(): string {
  return `grid-leaf-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create initial grid state with a single leaf node
 * @param groupId - Optional initial group ID (generates one if not provided)
 * @param width - Grid width in pixels (default: 800)
 * @param height - Grid height in pixels (default: 600)
 * @returns New GridState with single leaf
 */
export function createGridState(
  groupId?: string,
  width: number = 800,
  height: number = 600
): GridState {
  const leaf: GridLeafNode = {
    type: "leaf",
    groupId: groupId ?? generateGridLeafId(),
    size: 100,
  };

  return {
    root: leaf,
    orientation: "horizontal",
    width,
    height,
  };
}

/**
 * Find a node at the specified location within the grid
 * @param state - Current grid state
 * @param location - Grid location path
 * @returns The node at the location, or null if invalid
 *
 * @example
 * findNodeAtLocation(state, [0, 1]) // finds second child of first child
 */
export function findNodeAtLocation(state: GridState, location: GridLocation): GridNode | null {
  let node: GridNode = state.root;

  for (const index of location) {
    if (!isGridBranchNode(node)) {
      return null; // Can't traverse into leaf
    }
    if (index < 0 || index >= node.children.length) {
      return null; // Invalid index
    }
    node = node.children[index];
  }

  return node;
}

/**
 * Get the parent location for a node at the given location
 * @param location - Child location
 * @returns Parent location (empty array for root's parent)
 */
export function getParentLocation(location: GridLocation): GridLocation {
  return location.slice(0, -1);
}

/**
 * Validate if a location is valid within the grid
 * @param state - Current grid state
 * @param location - Location to validate
 * @returns true if location is valid, false otherwise
 */
export function validateLocation(state: GridState, location: GridLocation): boolean {
  return findNodeAtLocation(state, location) !== null;
}

/**
 * Add a view (leaf node) at a specified location with direction
 *
 * Logic matches VSCode's addView():
 * - Use tail() to get [rest, index]
 * - If parent is BranchNode, add child directly
 * - If parent is LeafNode, create new BranchNode with old + new leaf
 *
 * @param state - Current grid state
 * @param groupId - Group ID for the new view
 * @param location - Where to add the view
 * @param direction - Direction to split ("up", "down", "left", "right")
 * @param size - Optional size for the new view (default: equal split)
 * @returns New GridState with the view added
 */
export function addViewToGrid(
  state: GridState,
  groupId: string,
  location: GridLocation,
  direction: SplitDirection,
  size?: number
): GridState {
  const newLeaf: GridLeafNode = {
    type: "leaf",
    groupId,
    size: size ?? DEFAULT_LEAF_SIZE,
  };

  // Empty grid - create new root
  if (state.root.type === "leaf" && location.length === 0) {
    const orientation = directionToOrientation(direction);
    return {
      ...state,
      root: {
        type: "branch",
        orientation,
        children: [state.root, newLeaf],
        size: 100,
        sizes: [50, 50],
      },
    };
  }

  const [parentLocation, index] = tail(location);
  const parentNode = findNodeAtLocation(state, parentLocation);

  if (!parentNode) {
    return state; // Invalid location, return unchanged
  }

  // Parent is a branch - add directly
  if (isGridBranchNode(parentNode)) {
    return addViewToBranch(state, parentLocation, parentNode, newLeaf, index, direction);
  }

  // Parent is a leaf - need to create new branch
  if (isGridLeafNode(parentNode)) {
    return addViewToLeaf(state, parentLocation, parentNode, newLeaf, index, direction);
  }

  return state;
}

/**
 * Add a view when parent is a branch node
 */
function addViewToBranch(
  state: GridState,
  parentLocation: GridLocation,
  parent: GridBranchNode,
  newLeaf: GridLeafNode,
  index: number,
  direction: SplitDirection
): GridState {
  const childSize = newLeaf.size ?? DEFAULT_LEAF_SIZE;
  const newSizes = [...parent.sizes];
  newSizes.splice(index, 0, childSize);

  // Normalize sizes to sum to 100
  const totalSize = newSizes.reduce((sum, s) => sum + s, 0);
  const normalizedSizes = newSizes.map((s) => (s / totalSize) * 100);

  const newChildren = [...parent.children];
  newChildren.splice(index, 0, newLeaf);

  const newParent: GridBranchNode = {
    ...parent,
    children: newChildren,
    sizes: normalizedSizes,
  };

  return replaceNodeAtPath(state, parentLocation, newParent);
}

/**
 * Add a view when parent is a leaf node
 * Creates a new branch with the old leaf and new leaf as children
 */
function addViewToLeaf(
  state: GridState,
  parentLocation: GridLocation,
  parent: GridLeafNode,
  newLeaf: GridLeafNode,
  index: number,
  direction: SplitDirection
): GridState {
  const orientation = directionToOrientation(direction);

  // Create new branch with old leaf as first child
  const newBranch: GridBranchNode = {
    type: "branch",
    orientation,
    children: [parent, newLeaf],
    size: parent.size,
    sizes: [50, 50],
  };

  return replaceNodeAtPath(state, parentLocation, newBranch);
}

/**
 * Remove a view from the grid at the specified location
 *
 * Logic matches VSCode's removeView():
 * - After removal, if branch has 0 children, throw error
 * - If branch has 1 child, promote the child (remove unnecessary branch)
 * - Normalizes the tree to remove single-child branches
 *
 * @param state - Current grid state
 * @param location - Location of view to remove
 * @returns New GridState with the view removed, or original state if invalid
 */
export function removeViewFromGrid(state: GridState, location: GridLocation): GridState {
  if (location.length === 0) {
    return state; // Can't remove root
  }

  const [parentLocation, index] = tail(location);
  const parentNode = findNodeAtLocation(state, parentLocation);

  if (!parentNode || !isGridBranchNode(parentNode)) {
    return state; // Invalid parent
  }

  if (index < 0 || index >= parentNode.children.length) {
    return state; // Invalid index
  }

  const newChildren = parentNode.children.filter((_, i) => i !== index);
  const newSizes = parentNode.sizes.filter((_, i) => i !== index);

  // Normalize remaining sizes to sum to 100
  const totalSize = newSizes.reduce((sum, s) => sum + s, 0);
  const normalizedSizes = totalSize > 0 ? newSizes.map((s) => (s / totalSize) * 100) : [100];

  // If no children left, this is invalid - return original state
  if (newChildren.length === 0) {
    return state;
  }

  let newParent: GridNode;

  // Promote single child to parent (normalize)
  if (newChildren.length === 1) {
    const child = newChildren[0];
    // Preserve the child's size but use parent's size
    if (isGridLeafNode(child)) {
      newParent = { ...child, size: parentNode.size };
    } else {
      newParent = { ...child, size: parentNode.size };
    }
  } else {
    newParent = {
      ...parentNode,
      children: newChildren,
      sizes: normalizedSizes,
    };
  }

  const newState = replaceNodeAtPath(state, parentLocation, newParent);
  return normalizeGrid(newState);
}

/**
 * Move a view from one location to another
 *
 * Logic matches VSCode's moveView():
 * - Remove from source, add to destination
 * - Uses moveView() to reorder within same parent
 *
 * @param state - Current grid state
 * @param fromLocation - Source location
 * @param toLocation - Destination location
 * @param direction - Direction for split when adding to destination
 * @returns New GridState with the view moved
 */
export function moveViewInGrid(
  state: GridState,
  fromLocation: GridLocation,
  toLocation: GridLocation,
  direction: SplitDirection
): GridState {
  const fromNode = findNodeAtLocation(state, fromLocation);
  if (!fromNode || !isGridLeafNode(fromNode)) {
    return state; // Can only move leaves
  }

  // Check if moving within same parent (reorder)
  const [fromParentLoc, fromIndex] = tail(fromLocation);
  const [toParentLoc, toIndex] = tail(toLocation);

  const isSameParent =
    fromParentLoc.length === toParentLoc.length &&
    fromParentLoc.every((v, i) => v === toParentLoc[i]);

  if (isSameParent) {
    return moveWithinSameParent(state, fromParentLoc, fromIndex, toIndex);
  }

  // Move to different parent - remove and add
  // Note: fromNode was captured at line 333 before any state changes
  const stateAfterRemove = removeViewFromGrid(state, fromLocation);

  return addViewToGrid(stateAfterRemove, fromNode.groupId, toLocation, direction);
}

/**
 * Reorder views within the same parent branch
 */
function moveWithinSameParent(
  state: GridState,
  parentLocation: GridLocation,
  fromIndex: number,
  toIndex: number
): GridState {
  const parentNode = findNodeAtLocation(state, parentLocation);
  if (!parentNode || !isGridBranchNode(parentNode)) {
    return state;
  }

  if (fromIndex === toIndex) {
    return state;
  }

  const newChildren = [...parentNode.children];
  const [moved] = newChildren.splice(fromIndex, 1);
  newChildren.splice(toIndex, 0, moved);

  const newParent: GridBranchNode = {
    ...parentNode,
    children: newChildren,
  };

  return replaceNodeAtPath(state, parentLocation, newParent);
}

/**
 * Replace a node at a specific path with a new node
 * @param state - Current grid state
 * @param location - Location of node to replace
 * @param newNode - New node to insert
 * @returns New GridState with node replaced
 */
function replaceNodeAtPath(state: GridState, location: GridLocation, newNode: GridNode): GridState {
  if (location.length === 0) {
    return { ...state, root: newNode };
  }

  const [parentLocation, index] = tail(location);
  const parentNode = findNodeAtLocation(state, parentLocation);

  if (!parentNode || !isGridBranchNode(parentNode)) {
    return state;
  }

  if (index < 0 || index >= parentNode.children.length) {
    return state;
  }

  const newChildren = [...parentNode.children];
  newChildren[index] = newNode;

  const newParent: GridBranchNode = {
    ...parentNode,
    children: newChildren,
  };

  return replaceNodeAtPath(state, parentLocation, newParent);
}

/**
 * Normalize the grid by removing unnecessary branch nodes
 *
 * A branch with only one child should be replaced by that child
 * This keeps the tree structure minimal and efficient
 *
 * @param state - Current grid state
 * @returns Normalized GridState
 */
export function normalizeGrid(state: GridState): GridState {
  function normalizeNode(node: GridNode): GridNode {
    if (isGridLeafNode(node)) {
      return node;
    }

    // Normalize all children first
    const normalizedChildren = node.children.map(normalizeNode);

    // If only one child, promote it
    if (normalizedChildren.length === 1) {
      const child = normalizedChildren[0];
      // Child inherits parent's size
      if (isGridLeafNode(child)) {
        return { ...child, size: node.size };
      }
      return { ...child, size: node.size };
    }

    // Check if children changed
    const childrenChanged = normalizedChildren.some((child, i) => child !== node.children[i]);

    if (childrenChanged) {
      return { ...node, children: normalizedChildren };
    }

    return node;
  }

  const newRoot = normalizeNode(state.root);

  // Update root orientation if root changed from branch to leaf
  if (isGridLeafNode(newRoot)) {
    return { ...state, root: newRoot };
  }

  return { ...state, root: newRoot };
}

/**
 * Serialize grid state to JSON for persistence
 * Matches VSCode's ISerializedGridView interface
 * @param state - Grid state to serialize
 * @returns JSON-serializable object
 */
export function serializeGrid(state: GridState): {
  root: unknown;
  orientation: GridOrientation;
  width: number;
  height: number;
} {
  function serializeNode(node: GridNode): unknown {
    if (isGridLeafNode(node)) {
      return {
        type: "leaf",
        data: { groupId: node.groupId },
        size: node.size,
        visible: node.cachedVisibleSize === undefined,
        maximized: node.maximized ?? false,
      };
    }

    return {
      type: "branch",
      data: node.children.map(serializeNode),
      size: node.size,
      visible: true,
    };
  }

  return {
    root: serializeNode(state.root),
    orientation: state.orientation,
    width: state.width,
    height: state.height,
  };
}

/**
 * Deserialize grid state from JSON
 *
 * @param json - JSON object from serializeGrid()
 * @param groupIds - Set of valid group IDs to validate against
 * @returns Deserialized GridState, or null if invalid
 */
export function deserializeGrid(
  json: {
    root: unknown;
    orientation: GridOrientation;
    width: number;
    height: number;
  },
  groupIds?: Set<string>
): GridState | null {
  if (
    typeof json.width !== "number" ||
    typeof json.height !== "number" ||
    (json.orientation !== "horizontal" && json.orientation !== "vertical")
  ) {
    return null;
  }

  const root = deserializeNode(json.root, groupIds);
  if (!root) {
    return null;
  }

  return {
    root,
    orientation: json.orientation,
    width: json.width,
    height: json.height,
  };
}

/**
 * Deserialize a single node from JSON
 */
function deserializeNode(node: unknown, groupIds?: Set<string>): GridNode | null {
  if (typeof node !== "object" || node === null) {
    return null;
  }

  const { type } = node as { type?: string };

  if (type === "leaf") {
    const leaf = node as {
      data: { groupId: string };
      size: number;
      visible?: boolean;
      maximized?: boolean;
    };

    if (typeof leaf.data?.groupId !== "string") {
      return null;
    }

    // Validate group ID if provided
    if (groupIds && !groupIds.has(leaf.data.groupId)) {
      return null;
    }

    // Restore cachedVisibleSize based on the 'visible' flag
    // When visible is false, it means cachedVisibleSize was set
    const cachedVisibleSize = leaf.visible === false ? leaf.size : undefined;

    return {
      type: "leaf",
      groupId: leaf.data.groupId,
      size: typeof leaf.size === "number" ? leaf.size : 100,
      cachedVisibleSize,
      maximized: leaf.maximized ?? false,
    };
  }

  if (type === "branch") {
    const branch = node as {
      data: unknown[];
      size: number;
    };

    if (!Array.isArray(branch.data)) {
      return null;
    }

    const children = branch.data
      .map((child) => deserializeNode(child, groupIds))
      .filter((child): child is GridNode => child !== null);

    if (children.length === 0) {
      return null;
    }

    // Calculate sizes based on children
    const totalSize = children.reduce((sum, child) => sum + child.size, 0);
    const sizes = children.map((child) => {
      if (totalSize === 0) return 100 / children.length;
      return (child.size / totalSize) * 100;
    });

    // Determine orientation from first branch child, or default to horizontal
    const firstBranchChild = children.find(isGridBranchNode);
    const orientation = firstBranchChild?.orientation ?? "horizontal";

    return {
      type: "branch",
      orientation,
      children,
      size: typeof branch.size === "number" ? branch.size : 100,
      sizes,
    };
  }

  return null;
}

/**
 * Get all leaf nodes in the grid (breadth-first traversal)
 * @param state - Grid state
 * @returns Array of [location, leaf] tuples
 */
export function getAllLeaves(state: GridState): [GridLocation, GridLeafNode][] {
  const result: [GridLocation, GridLeafNode][] = [];

  function traverse(node: GridNode, location: GridLocation): void {
    if (isGridLeafNode(node)) {
      result.push([location, node]);
    } else if (isGridBranchNode(node)) {
      node.children.forEach((child, i) => {
        traverse(child, [...location, i]);
      });
    }
  }

  traverse(state.root, []);
  return result;
}

/**
 * Find a leaf by its group ID
 * @param state - Grid state
 * @param groupId - Group ID to find
 * @returns Tuple of [location, leaf] or null if not found
 */
export function findLeafByGroupId(
  state: GridState,
  groupId: string
): [GridLocation, GridLeafNode] | null {
  const leaves = getAllLeaves(state);
  return leaves.find(([, leaf]) => leaf.groupId === groupId) ?? null;
}

/**
 * Resize a leaf at a specific location
 * @param state - Grid state
 * @param location - Location of leaf to resize
 * @param size - New size (percentage)
 * @returns New GridState with resized leaf
 */
export function resizeLeaf(state: GridState, location: GridLocation, size: number): GridState {
  if (location.length === 0) {
    return state;
  }

  const [parentLocation, index] = tail(location);
  const parentNode = findNodeAtLocation(state, parentLocation);

  if (!parentNode || !isGridBranchNode(parentNode)) {
    return state;
  }

  if (index < 0 || index >= parentNode.children.length) {
    return state;
  }

  // Update sizes array
  const newSizes = [...parentNode.sizes];
  newSizes[index] = size;

  // Normalize to sum to 100
  const totalSize = newSizes.reduce((sum, s) => sum + s, 0);
  const normalizedSizes = newSizes.map((s) => (s / totalSize) * 100);

  const newParent: GridBranchNode = {
    ...parentNode,
    sizes: normalizedSizes,
  };

  return replaceNodeAtPath(state, parentLocation, newParent);
}

/**
 * Migrate flat PanelGroup[] array to GridState
 * This is used during migration from the old panel system to the new grid system
 * @param panelGroups - Flat array of panel groups
 * @param panelLayout - Layout direction and sizes
 * @returns New GridState
 */
export function migrateToGridState(
  panelGroups: PanelGroup[],
  panelLayout: { direction: "horizontal" | "vertical" | "single"; sizes: number[] }
): GridState {
  if (panelGroups.length === 0) {
    return createGridState(undefined, 800, 600);
  }

  if (panelGroups.length === 1) {
    return createGridState(panelGroups[0].id, 800, 600);
  }

  // For multiple groups, create a branch node
  const leaves: GridLeafNode[] = panelGroups.map((group) => ({
    type: "leaf",
    groupId: group.id,
    size: group.percentage,
  }));

  // Determine orientation from layout direction
  const orientation: GridOrientation =
    panelLayout.direction === "horizontal" || panelLayout.direction === "vertical"
      ? panelLayout.direction
      : "horizontal";

  const root: GridBranchNode = {
    type: "branch",
    orientation,
    children: leaves,
    size: 100,
    sizes: panelLayout.sizes,
  };

  return {
    root,
    orientation,
    width: 800,
    height: 600,
  };
}

/**
 * Find the nearest sibling leaf node to a given location
 * Used for focus transfer when closing a panel
 * @param state - Grid state
 * @param location - Location of the leaf to find sibling for
 * @returns Location and leaf of nearest sibling, or null if no siblings
 */
export function findNearestSiblingLeaf(
  state: GridState,
  location: GridLocation
): [GridLocation, GridLeafNode] | null {
  if (location.length === 0) {
    return null; // Root has no siblings
  }

  const [parentLocation, index] = tail(location);
  const parentNode = findNodeAtLocation(state, parentLocation);

  if (!parentNode || !isGridBranchNode(parentNode)) {
    return null; // Invalid parent
  }

  // Try to find a sibling leaf
  const siblingIndices: number[] = [];

  // Add previous sibling indices in reverse order (closest first)
  for (let i = index - 1; i >= 0; i--) {
    siblingIndices.push(i);
  }

  // Add next sibling indices
  for (let i = index + 1; i < parentNode.children.length; i++) {
    siblingIndices.push(i);
  }

  for (const siblingIndex of siblingIndices) {
    const sibling = parentNode.children[siblingIndex];
    const siblingLocation = [...parentLocation, siblingIndex];

    // If sibling is a leaf, return it
    if (isGridLeafNode(sibling)) {
      return [siblingLocation, sibling];
    }

    // If sibling is a branch, find first leaf descendant
    if (isGridBranchNode(sibling)) {
      const firstLeaf = findFirstLeafInBranch(sibling, siblingLocation);
      if (firstLeaf) {
        return firstLeaf;
      }
    }
  }

  return null;
}

/**
 * Find the first leaf node in a branch (depth-first search)
 * @param branch - Branch node to search
 * @param branchLocation - Location of the branch
 * @returns Location and leaf of first descendant, or null if no leaves
 */
function findFirstLeafInBranch(
  branch: GridBranchNode,
  branchLocation: GridLocation
): [GridLocation, GridLeafNode] | null {
  for (let i = 0; i < branch.children.length; i++) {
    const child = branch.children[i];
    const childLocation = [...branchLocation, i];

    if (isGridLeafNode(child)) {
      return [childLocation, child];
    }

    if (isGridBranchNode(child)) {
      const result = findFirstLeafInBranch(child, childLocation);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Convert GridState back to flat PanelGroup[] array
 * This is used for backward compatibility during migration
 * @param state - Grid state
 * @param panelGroupsMap - Map of groupId to PanelGroup for tab data
 * @returns Flat array of panel groups with layout info
 */
export function migrateFromGridState(
  state: GridState,
  panelGroupsMap: Record<string, PanelGroup>
): {
  groups: PanelGroup[];
  layout: { direction: "horizontal" | "vertical" | "single"; sizes: number[] };
} {
  const leaves = getAllLeaves(state);

  if (leaves.length === 0) {
    return {
      groups: [],
      layout: { direction: "single", sizes: [100] },
    };
  }

  if (leaves.length === 1) {
    const [location, leaf] = leaves[0];
    const group = panelGroupsMap[leaf.groupId];
    if (!group) {
      return {
        groups: [],
        layout: { direction: "single", sizes: [100] },
      };
    }

    return {
      groups: [{ ...group, percentage: leaf.size }],
      layout: { direction: "single", sizes: [100] },
    };
  }

  // Multiple groups - extract from branch structure
  const groups: PanelGroup[] = leaves.map(([location, leaf]) => {
    const group = panelGroupsMap[leaf.groupId];
    if (!group) {
      return {
        id: leaf.groupId,
        tabs: [],
        activeTabId: null,
        focused: false,
        percentage: leaf.size,
      };
    }
    return {
      ...group,
      percentage: leaf.size,
    };
  });

  // Get sizes from the root branch
  let sizes: number[] = [];
  if (isGridBranchNode(state.root)) {
    sizes = state.root.sizes;
  } else {
    sizes = leaves.map(([, leaf]) => leaf.size);
  }

  return {
    groups,
    layout: {
      direction: state.orientation,
      sizes,
    },
  };
}
