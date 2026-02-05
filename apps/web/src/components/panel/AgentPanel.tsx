import { AgentTabContent } from "../AgentTabs/AgentTabContent";

interface AgentPanelProps {
  agent: { id: string; name: string; icon: string };
}

export function AgentPanel({ agent }: AgentPanelProps) {
  return <AgentTabContent agentId={agent.id} agentName={agent.name} />;
}
