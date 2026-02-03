/**
 * Tree Utilities
 *
 * Common utilities for tree manipulation
 */

import type { FileTreeNode } from "../types";

/**
 * Update a tree node at a specific path
 */
export function updateTreeNode(
  nodes: FileTreeNode[],
  targetPath: string,
  updater: (node: FileTreeNode) => FileTreeNode
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return updater(node);
    }
    if (node.children) {
      return {
        ...node,
        children: updateTreeNode(node.children, targetPath, updater),
      };
    }
    return node;
  });
}

/**
 * Remove a tree node at a specific path
 */
export function removeTreeNode(nodes: FileTreeNode[], targetPath: string): FileTreeNode[] {
  return nodes.filter((node) => {
    if (node.path === targetPath) {
      return false;
    }
    if (node.children) {
      node.children = removeTreeNode(node.children, targetPath);
    }
    return true;
  });
}

/**
 * Add a tree node to a parent path
 */
export function addTreeNode(
  nodes: FileTreeNode[],
  parentPath: string,
  newNode: FileTreeNode
): FileTreeNode[] {
  // If parent is root (empty string), add to root level
  if (!parentPath) {
    const updated = [...nodes, newNode];
    return sortTreeNodes(updated);
  }

  return nodes.map((node) => {
    if (node.path === parentPath && node.type === "dir") {
      const children = node.children || [];
      const updated = sortTreeNodes([...children, newNode]);
      return { ...node, children: updated, expanded: true };
    }
    if (node.children) {
      return { ...node, children: addTreeNode(node.children, parentPath, newNode) };
    }
    return node;
  });
}

/**
 * Sort tree nodes (directories first, then alphabetically)
 */
export function sortTreeNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Find a node by path
 */
export function findTreeNode(nodes: FileTreeNode[], targetPath: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node;
    }
    if (node.children) {
      const found = findTreeNode(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get all expanded nodes
 */
export function getExpandedNodes(nodes: FileTreeNode[]): string[] {
  const expanded: string[] = [];
  function traverse(nodeList: FileTreeNode[]) {
    for (const node of nodeList) {
      if (node.expanded) {
        expanded.push(node.path);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return expanded;
}

/**
 * Collapse all nodes
 */
export function collapseAllNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    expanded: false,
    children: node.children ? collapseAllNodes(node.children) : undefined,
  }));
}
