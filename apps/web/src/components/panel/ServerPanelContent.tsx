/**
 * Server Panel Content - Local server list with tunnel integration
 */

import { ServerListPanel } from "../ServerListPanel";

interface ServerPanelContentProps {
  onServerSelect?: (server: {
    url: string;
    name: string;
    port: number;
    status: string;
    type: string;
  }) => void;
  selectedUrl?: string;
}

export function ServerPanelContent({ onServerSelect, selectedUrl }: ServerPanelContentProps) {
  return (
    <div className="server-panel-content">
      <ServerListPanel onServerSelect={onServerSelect} selectedUrl={selectedUrl} />
    </div>
  );
}
