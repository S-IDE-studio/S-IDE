/**
 * UI State Context
 *
 * Provides UI state management for modals, panels, and messages
 */

import { createContext, useContext, useState } from "react";
import type { SidebarPanel, WorkspaceMode } from "../types";

export interface UIStateContextValue {
  // Workspace mode
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (mode: WorkspaceMode) => void;

  // Sidebar
  sidebarPanel: SidebarPanel;
  setSidebarPanel: (panel: SidebarPanel) => void;

  // Status messages
  statusMessage: string;
  setStatusMessage: (message: string) => void;

  // Modals
  isWorkspaceModalOpen: boolean;
  setIsWorkspaceModalOpen: (open: boolean) => void;
  isDeckModalOpen: boolean;
  setIsDeckModalOpen: (open: boolean) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;
  isServerModalOpen: boolean;
  setIsServerModalOpen: (open: boolean) => void;
  isEnvironmentModalOpen: boolean;
  setIsEnvironmentModalOpen: (open: boolean) => void;
  isCommonSettingsOpen: boolean;
  setIsCommonSettingsOpen: (open: boolean) => void;

  // Context status
  showContextStatus: boolean;
  setShowContextStatus: (show: boolean) => void;
  contextHealthScore: number;
  setContextHealthScore: (score: number) => void;

  // Server readiness
  serverReady: boolean;
  setServerReady: (ready: boolean) => void;
}

export const UIStateContext = createContext<UIStateContextValue | null>(null);

interface UIStateProviderProps {
  children: React.ReactNode;
}

export function UIStateProvider({ children }: UIStateProviderProps) {
  // Workspace mode
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("list");

  // Sidebar
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("files");

  // Status messages
  const [statusMessage, setStatusMessage] = useState("");

  // Modals
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [isEnvironmentModalOpen, setIsEnvironmentModalOpen] = useState(false);
  const [isCommonSettingsOpen, setIsCommonSettingsOpen] = useState(false);

  // Context status
  const [showContextStatus, setShowContextStatus] = useState(false);
  const [contextHealthScore, setContextHealthScore] = useState(100);

  // Server readiness
  const [serverReady, setServerReady] = useState(true);

  const value: UIStateContextValue = {
    workspaceMode,
    setWorkspaceMode,
    sidebarPanel,
    setSidebarPanel,
    statusMessage,
    setStatusMessage,
    isWorkspaceModalOpen,
    setIsWorkspaceModalOpen,
    isDeckModalOpen,
    setIsDeckModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isServerModalOpen,
    setIsServerModalOpen,
    isEnvironmentModalOpen,
    setIsEnvironmentModalOpen,
    isCommonSettingsOpen,
    setIsCommonSettingsOpen,
    showContextStatus,
    setShowContextStatus,
    contextHealthScore,
    setContextHealthScore,
    serverReady,
    setServerReady,
  };

  return <UIStateContext.Provider value={value}>{children}</UIStateContext.Provider>;
}

export function useUIStateContext(): UIStateContextValue {
  const context = useContext(UIStateContext);
  if (!context) {
    throw new Error("useUIStateContext must be used within UIStateProvider");
  }
  return context;
}
