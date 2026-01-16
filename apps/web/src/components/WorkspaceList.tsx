import { useState } from 'react';
import type { Workspace } from '../types';

interface WorkspaceListProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  defaultPath: string;
  onSelect: (workspaceId: string) => void;
  onCreate: (name: string, path: string) => void;
  onOpenEditor: (workspaceId: string) => void;
}

export function WorkspaceList({
  workspaces,
  activeWorkspaceId,
  defaultPath,
  onSelect,
  onCreate,
  onOpenEditor
}: WorkspaceListProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState(defaultPath);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPath = path.trim() || defaultPath;
    onCreate(trimmedName, trimmedPath);
    setName('');
    setPath(trimmedPath);
  };

  return (
    <section className="panel workspace-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">ワークスペース</div>
          <div className="panel-subtitle">作業フォルダを定義</div>
        </div>
      </div>
      <form className="workspace-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>名前</span>
          <input
            type="text"
            value={name}
            placeholder="ワークスペース名"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>パス</span>
          <input
            type="text"
            value={path}
            placeholder={defaultPath}
            onChange={(event) => setPath(event.target.value)}
          />
        </label>
        <button type="submit" className="chip">
          追加
        </button>
      </form>
      <div className="panel-body">
        {workspaces.map((workspace) => (
          <div
            key={workspace.id}
            className={`workspace-item ${
              workspace.id === activeWorkspaceId ? 'is-active' : ''
            }`}
          >
            <button
              type="button"
              className="workspace-main"
              onClick={() => onSelect(workspace.id)}
            >
              <div className="workspace-name">{workspace.name}</div>
              <div className="workspace-path">{workspace.path}</div>
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => onOpenEditor(workspace.id)}
            >
              エディタを開く
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
