/**
 * Agent Context
 *
 * Provides agent state and operations throughout the app
 */

import { createContext, useCallback, useContext, useState } from "react";
import type { Agent } from "../types";

export interface AgentContextValue {
  agents: Agent[];
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  activeAgent: string | null;
  setActiveAgent: (agentId: string | null) => void;
  getActiveAgent: () => Agent | null;
  getEnabledAgents: () => Agent[];
}

export const AgentContext = createContext<AgentContextValue | null>(null);

interface AgentProviderProps {
  children: React.ReactNode;
}

export function AgentProvider({ children }: AgentProviderProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);

  const getActiveAgent = useCallback((): Agent | null => {
    return agents.find((agent) => agent.id === activeAgent) || null;
  }, [agents, activeAgent]);

  const getEnabledAgents = useCallback((): Agent[] => {
    return agents.filter((agent) => agent.enabled);
  }, [agents]);

  const value: AgentContextValue = {
    agents,
    setAgents,
    activeAgent,
    setActiveAgent,
    getActiveAgent,
    getEnabledAgents,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgentContext(): AgentContextValue {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgentContext must be used within AgentProvider");
  }
  return context;
}
