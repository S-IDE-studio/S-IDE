interface AgentPanelProps {
  agent: { id: string; name: string; icon: string };
}

export function AgentPanel({ agent }: AgentPanelProps) {
  return <div className="agent-panel-content">Agent: {agent.name}</div>;
}
