import { useCallback, useEffect, useState } from "react";
import { createWorkspace as apiCreateWorkspace, deleteWorkspace as apiDeleteWorkspace, listWorkspaces } from "../api";
import type { Workspace } from "../types";
import { createEmptyWorkspaceState, getErrorMessage, normalizeWorkspacePath } from "../utils";

interface UseWorkspacesProps {
  setStatusMessage: (message: string) => void;
  defaultRoot: string;
  initializeWorkspaceStates: (workspaceIds: string[]) => void;
  setWorkspaceStates: React.Dispatch<
    React.SetStateAction<Record<string, import("../types").WorkspaceState>>
  >;
}

export const useWorkspaces = ({
  setStatusMessage,
  defaultRoot,
  initializeWorkspaceStates,
  setWorkspaceStates,
}: UseWorkspacesProps) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [editorWorkspaceId, setEditorWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    listWorkspaces()
      .then((data) => {
        if (signal.aborted) return;
        setWorkspaces(data);
        setEditorWorkspaceId((prev) => {
          // Keep previous selection if valid
          if (prev && data.some((workspace) => workspace.id === prev)) {
            return prev;
          }
          // Auto-select most recent workspace (by createdAt)
          if (data.length > 0) {
            const sortedByDate = [...data].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            return sortedByDate[0].id;
          }
          return null;
        });
        initializeWorkspaceStates(data.map((workspace) => workspace.id));
      })
      .catch((error: unknown) => {
        if (signal.aborted) return;
        setStatusMessage(
          `\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      });

    return () => {
      abortController.abort();
    };
  }, [setStatusMessage, initializeWorkspaceStates]);

  const handleCreateWorkspace = useCallback(
    async (path: string) => {
      const trimmedPath = path.trim();
      const resolvedPath = trimmedPath || defaultRoot;
      if (!resolvedPath) {
        setStatusMessage(
          "\u30d1\u30b9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002"
        );
        return null;
      }
      const normalized = normalizeWorkspacePath(resolvedPath);
      const existingWorkspace = workspaces.find(
        (workspace) => normalizeWorkspacePath(workspace.path) === normalized
      );
      // If workspace already exists, just select it
      if (existingWorkspace) {
        setEditorWorkspaceId(existingWorkspace.id);
        return existingWorkspace;
      }
      try {
        const workspace = await apiCreateWorkspace(resolvedPath);
        setWorkspaces((prev) => [...prev, workspace]);
        setEditorWorkspaceId(workspace.id);
        setWorkspaceStates((prev) => ({
          ...prev,
          [workspace.id]: createEmptyWorkspaceState(),
        }));
        return workspace;
      } catch (error: unknown) {
        setStatusMessage(
          `\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u3092\u8ffd\u52a0\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
        return null;
      }
    },
    [workspaces, defaultRoot, setStatusMessage, setWorkspaceStates]
  );

  const handleDeleteWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        await apiDeleteWorkspace(workspaceId);
        // Remove from local state
        setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
        // Clear workspace state
        setWorkspaceStates((prev) => {
          const newState = { ...prev };
          delete newState[workspaceId];
          return newState;
        });
        // If deleted workspace was active, clear selection
        setEditorWorkspaceId((prev) => (prev === workspaceId ? null : prev));
      } catch (error: unknown) {
        setStatusMessage(
          `\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u3092\u524a\u9664\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      }
    },
    [setStatusMessage, setWorkspaceStates]
  );

  return {
    workspaces,
    editorWorkspaceId,
    setEditorWorkspaceId,
    handleCreateWorkspace,
    handleDeleteWorkspace,
  };
};
