/**
 * Workspace Context
 *
 * Provides workspace state and operations throughout the app
 */

import { createContext, useCallback, useContext, useState } from "react";
import type { Workspace, WorkspaceState } from "../types";
import { createEmptyWorkspaceState } from "../utils";

export interface WorkspaceContextValue {
  workspaces: Workspace[];
  workspaceStates: Record<string, WorkspaceState>;
  editorWorkspaceId: string | null;
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
  setWorkspaceStates: React.Dispatch<React.SetStateAction<Record<string, WorkspaceState>>>;
  setEditorWorkspaceId: (id: string | null) => void;
  updateWorkspaceState: (
    workspaceId: string,
    updater: (state: WorkspaceState) => WorkspaceState
  ) => void;
  initializeWorkspaceStates: (workspaceIds: string[]) => void;
  getActiveWorkspace: () => Workspace | null;
  getActiveWorkspaceState: () => WorkspaceState;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceStates, setWorkspaceStates] = useState<Record<string, WorkspaceState>>({});
  const [editorWorkspaceId, setEditorWorkspaceId] = useState<string | null>(null);

  const updateWorkspaceState = useCallback(
    (workspaceId: string, updater: (state: WorkspaceState) => WorkspaceState) => {
      setWorkspaceStates((prev) => {
        const current = prev[workspaceId] || createEmptyWorkspaceState();
        return { ...prev, [workspaceId]: updater(current) };
      });
    },
    []
  );

  const initializeWorkspaceStates = useCallback((workspaceIds: string[]) => {
    setWorkspaceStates((prev) => {
      const next = { ...prev };
      workspaceIds.forEach((id) => {
        if (!next[id]) {
          next[id] = createEmptyWorkspaceState();
        }
      });
      return next;
    });
  }, []);

  const getActiveWorkspace = useCallback((): Workspace | null => {
    return workspaces.find((workspace) => workspace.id === editorWorkspaceId) || null;
  }, [workspaces, editorWorkspaceId]);

  const getActiveWorkspaceState = useCallback((): WorkspaceState => {
    const defaultState = createEmptyWorkspaceState();
    return editorWorkspaceId ? workspaceStates[editorWorkspaceId] || defaultState : defaultState;
  }, [editorWorkspaceId, workspaceStates]);

  const value: WorkspaceContextValue = {
    workspaces,
    workspaceStates,
    editorWorkspaceId,
    setWorkspaces,
    setWorkspaceStates,
    setEditorWorkspaceId,
    updateWorkspaceState,
    initializeWorkspaceStates,
    getActiveWorkspace,
    getActiveWorkspaceState,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
  }
  return context;
}
