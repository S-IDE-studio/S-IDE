type AppView = 'workspace' | 'terminal';

interface SideNavProps {
  activeView: AppView;
  onSelect: (view: AppView) => void;
}

export function SideNav({ activeView, onSelect }: SideNavProps) {
  return (
    <nav className="side-nav">
      <button
        type="button"
        className={activeView === 'workspace' ? 'is-active' : ''}
        onClick={() => onSelect('workspace')}
      >
        ワークスペース
      </button>
      <button
        type="button"
        className={activeView === 'terminal' ? 'is-active' : ''}
        onClick={() => onSelect('terminal')}
      >
        ターミナル
      </button>
    </nav>
  );
}
