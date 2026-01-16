import type { Workspace } from '../types';

type AppView = 'workspace' | 'terminal';

interface TopBarProps {
  view: AppView;
  workspace?: Workspace | null;
  apiBase?: string;
  status?: string;
}

export function TopBar({ view, workspace, apiBase, status }: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <div className="brand">Deck IDE</div>
        <div className="deck-meta">
          <span>{view === 'workspace' ? 'ワークスペース' : 'ターミナル'}</span>
          {workspace ? (
            <>
              <span className="deck-root">{workspace.name}</span>
              <span className="deck-root">{workspace.path}</span>
            </>
          ) : null}
          {apiBase ? <span className="api-base">{apiBase}</span> : null}
        </div>
      </div>
      <div className="topbar-actions">
        {status ? <div className="status-pill">{status}</div> : null}
      </div>
    </header>
  );
}
