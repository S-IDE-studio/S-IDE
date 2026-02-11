import type { IDockviewPanelProps } from "dockview";
import { ServerPanelContent } from "../../panel/ServerPanelContent";
import { useDockviewContext } from "../DockviewContext";

/**
 * Adapter for Server panel in dockview
 * Wraps ServerPanelContent with dockview context and params
 */
export function ServerPanelAdapter(
  _props: IDockviewPanelProps<{ tab: import("../../../types").UnifiedTab }>
) {
  const ctx = useDockviewContext();

  const handleServerSelect = (server: {
    url: string;
    name: string;
    port: number;
    status: string;
    type: string;
  }) => {
    // Open a new remote access tab for the selected server
    ctx.openTab({
      id: `remote-access-${server.url}`,
      kind: "remoteAccess",
      title: server.name,
      icon: "globe",
      data: { remoteAccess: { id: server.url, name: server.name } },
    });
  };

  return <ServerPanelContent onServerSelect={handleServerSelect} />;
}
