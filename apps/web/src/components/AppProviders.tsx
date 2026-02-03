/**
 * App Providers
 *
 * Combines all context providers into a single component
 */

import type { ReactNode } from "react";
import { AgentProvider, DeckProvider, UIStateProvider, WorkspaceProvider } from "../contexts";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <UIStateProvider>
      <WorkspaceProvider>
        <DeckProvider>
          <AgentProvider>{children}</AgentProvider>
        </DeckProvider>
      </WorkspaceProvider>
    </UIStateProvider>
  );
}
