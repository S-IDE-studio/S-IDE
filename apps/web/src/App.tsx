import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { DeckList } from './components/DeckList';
import { EditorPane } from './components/EditorPane';
import { FileTree } from './components/FileTree';
import { SideNav } from './components/SideNav';
import { TerminalPane } from './components/TerminalPane';
import { WorkspaceList } from './components/WorkspaceList';
import {
  createDeck as apiCreateDeck,
  createTerminal as apiCreateTerminal,
  createWorkspace as apiCreateWorkspace,
  getConfig,
  getWsBase,
  listDecks,
  listFiles,
  listWorkspaces,
  previewFiles,
  readFile,
  writeFile
} from './api';
import type {
  Deck,
  DeckState,
  EditorFile,
  FileSystemEntry,
  FileTreeNode,
  Workspace,
  WorkspaceState
} from './types';

type AppView = 'workspace' | 'terminal';
type WorkspaceMode = 'list' | 'editor';
type UrlState = {
  view: AppView;
  workspaceId: string | null;
  deckId: string | null;
  workspaceMode: WorkspaceMode;
};

const DEFAULT_ROOT_FALLBACK = import.meta.env.VITE_DEFAULT_ROOT || '';
const SAVED_MESSAGE = '\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  ps1: 'powershell',
  py: 'python',
  go: 'go',
  rs: 'rust'
};

const createEmptyWorkspaceState = (): WorkspaceState => ({
  files: [],
  activeFileId: null,
  tree: [],
  treeLoading: false,
  treeError: null
});

const createEmptyDeckState = (): DeckState => ({
  terminals: [],
  activeTerminalId: null
});

const toTreeNodes = (entries: FileSystemEntry[]): FileTreeNode[] =>
  entries.map((entry) => ({
    ...entry,
    expanded: false,
    loading: false,
    children: entry.type === 'dir' ? [] : undefined
  }));

const getLanguageFromPath = (filePath: string): string => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  return LANGUAGE_BY_EXTENSION[extension] || 'plaintext';
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const normalizeWorkspacePath = (value: string): string =>
  value
    .trim()
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLowerCase();

const parseUrlState = (): UrlState => {
  if (typeof window === 'undefined') {
    return {
      view: 'terminal',
      workspaceId: null,
      deckId: null,
      workspaceMode: 'list'
    };
  }
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  const modeParam = params.get('mode');
  return {
    view: viewParam === 'workspace' ? 'workspace' : 'terminal',
    workspaceId: params.get('workspace'),
    deckId: params.get('deck'),
    workspaceMode: modeParam === 'editor' ? 'editor' : 'list'
  };
};

export default function App() {
  const initialUrlState = parseUrlState();
  const [view, setView] = useState<AppView>(initialUrlState.view);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    initialUrlState.workspaceMode
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    initialUrlState.workspaceId ?? null
  );
  const [defaultRoot, setDefaultRoot] = useState(DEFAULT_ROOT_FALLBACK);
  const [workspaceStates, setWorkspaceStates] = useState<
    Record<string, WorkspaceState>
  >({});
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(
    initialUrlState.deckId ?? null
  );
  const [deckStates, setDeckStates] = useState<Record<string, DeckState>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [savingFileId, setSavingFileId] = useState<string | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [workspacePathDraft, setWorkspacePathDraft] = useState('');
  const [previewTree, setPreviewTree] = useState<FileTreeNode[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const defaultWorkspaceState = useMemo(
    () => createEmptyWorkspaceState(),
    []
  );
  const defaultDeckState = useMemo(() => createEmptyDeckState(), []);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
  const activeWorkspaceState = activeWorkspaceId
    ? workspaceStates[activeWorkspaceId] || defaultWorkspaceState
    : defaultWorkspaceState;
  const activeDeckState = activeDeckId
    ? deckStates[activeDeckId] || defaultDeckState
    : defaultDeckState;
  const wsBase = getWsBase();
  const previewRoot = workspacePathDraft.trim() || defaultRoot;

  const decksForWorkspace = activeWorkspaceId
    ? decks.filter((deck) => deck.workspaceId === activeWorkspaceId)
    : [];
  const deckListItems = decksForWorkspace.map((deck) => ({
    id: deck.id,
    name: deck.name,
    path: deck.root
  }));

  const updateWorkspaceState = useCallback(
    (workspaceId: string, updater: (state: WorkspaceState) => WorkspaceState) => {
      setWorkspaceStates((prev) => {
        const current = prev[workspaceId] || createEmptyWorkspaceState();
        return { ...prev, [workspaceId]: updater(current) };
      });
    },
    []
  );

  const updateDeckState = useCallback(
    (deckId: string, updater: (state: DeckState) => DeckState) => {
      setDeckStates((prev) => {
        const current = prev[deckId] || createEmptyDeckState();
        return { ...prev, [deckId]: updater(current) };
      });
    },
    []
  );

  useEffect(() => {
    let alive = true;
    getConfig()
      .then((config) => {
        if (!alive) return;
        if (config?.defaultRoot) {
          setDefaultRoot(config.defaultRoot);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseUrlState();
      setView(next.view);
      setActiveWorkspaceId(next.workspaceId ?? null);
      setActiveDeckId(next.deckId ?? null);
      setWorkspaceMode(next.workspaceMode);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', view);
    if (activeWorkspaceId) {
      params.set('workspace', activeWorkspaceId);
    }
    if (activeDeckId) {
      params.set('deck', activeDeckId);
    }
    if (view === 'workspace' && workspaceMode === 'editor' && activeWorkspaceId) {
      params.set('mode', 'editor');
    }
    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [view, activeWorkspaceId, activeDeckId, workspaceMode]);

  useEffect(() => {
    let alive = true;
    listWorkspaces()
      .then((data) => {
        if (!alive) return;
        setWorkspaces(data);
        setActiveWorkspaceId((prev) => {
          if (prev && data.some((workspace) => workspace.id === prev)) {
            return prev;
          }
          return data[0]?.id ?? null;
        });
        setWorkspaceStates((prev) => {
          const next = { ...prev };
          data.forEach((workspace) => {
            if (!next[workspace.id]) {
              next[workspace.id] = createEmptyWorkspaceState();
            }
          });
          return next;
        });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setStatusMessage(
          `\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      });

    listDecks()
      .then((data) => {
        if (!alive) return;
        setDecks(data);
        setDeckStates((prev) => {
          const next = { ...prev };
          data.forEach((deck) => {
            if (!next[deck.id]) {
              next[deck.id] = createEmptyDeckState();
            }
          });
          return next;
        });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setStatusMessage(
          `\u30c7\u30c3\u30ad\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (statusMessage !== SAVED_MESSAGE) return;
    const timer = setTimeout(() => setStatusMessage(''), 2000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (workspaceMode === 'editor' && !activeWorkspaceId) {
      setWorkspaceMode('list');
    }
  }, [workspaceMode, activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setActiveDeckId(null);
      return;
    }
    const workspaceDecks = decks.filter(
      (deck) => deck.workspaceId === activeWorkspaceId
    );
    if (workspaceDecks.length === 0) {
      setActiveDeckId(null);
      return;
    }
    if (!workspaceDecks.some((deck) => deck.id === activeDeckId)) {
      setActiveDeckId(workspaceDecks[0].id);
    }
  }, [activeWorkspaceId, decks, activeDeckId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const current = workspaceStates[activeWorkspaceId];
    if (current?.tree?.length || current?.treeLoading) return;
    updateWorkspaceState(activeWorkspaceId, (state) => ({
      ...state,
      treeLoading: true,
      treeError: null
    }));
    listFiles(activeWorkspaceId, '')
      .then((entries) => {
        updateWorkspaceState(activeWorkspaceId, (state) => ({
          ...state,
          tree: toTreeNodes(entries),
          treeLoading: false
        }));
      })
      .catch((error: unknown) => {
        updateWorkspaceState(activeWorkspaceId, (state) => ({
          ...state,
          treeLoading: false,
          treeError: getErrorMessage(error)
        }));
      });
  }, [activeWorkspaceId, updateWorkspaceState, workspaceStates]);

  useEffect(() => {
    if (!isWorkspaceModalOpen) {
      setPreviewTree([]);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }
    let alive = true;
    setPreviewLoading(true);
    setPreviewError(null);
    previewFiles(previewRoot, '')
      .then((entries) => {
        if (!alive) return;
        setPreviewTree(toTreeNodes(entries));
        setPreviewLoading(false);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setPreviewError(getErrorMessage(error));
        setPreviewLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isWorkspaceModalOpen, previewRoot]);

  const handleCreateWorkspace = async (path: string) => {
    const trimmedPath = path.trim();
    const resolvedPath = trimmedPath || defaultRoot;
    if (!resolvedPath) {
      setStatusMessage(
        '\u30d1\u30b9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
      );
      return null;
    }
    const normalized = normalizeWorkspacePath(resolvedPath);
    const exists = workspaces.some(
      (workspace) => normalizeWorkspacePath(workspace.path) === normalized
    );
    if (exists) {
      setStatusMessage(
        '\u540c\u3058\u30d1\u30b9\u306e\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u306f\u8ffd\u52a0\u3067\u304d\u307e\u305b\u3093\u3002'
      );
      return null;
    }
    try {
      const workspace = await apiCreateWorkspace(resolvedPath);
      setWorkspaces((prev) => [...prev, workspace]);
      setActiveWorkspaceId(workspace.id);
      setWorkspaceStates((prev) => ({
        ...prev,
        [workspace.id]: createEmptyWorkspaceState()
      }));
      return workspace;
    } catch (error: unknown) {
      setStatusMessage(
        `\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u3092\u8ffd\u52a0\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
      );
      return null;
    }
  };

  const handleCreateDeck = async (workspaceId: string | null) => {
    if (!workspaceId) {
      setStatusMessage(
        '\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
      );
      return;
    }
    try {
      const deck = await apiCreateDeck(
        `\u30c7\u30c3\u30ad ${decks.length + 1}`,
        workspaceId
      );
      setDecks((prev) => [...prev, deck]);
      setActiveDeckId(deck.id);
      setDeckStates((prev) => ({
        ...prev,
        [deck.id]: createEmptyDeckState()
      }));
    } catch (error: unknown) {
      setStatusMessage(
        `\u30c7\u30c3\u30ad\u306e\u4f5c\u6210\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${getErrorMessage(error)}`
      );
    }
  };

  const handleRefreshTree = () => {
    if (!activeWorkspaceId) return;
    updateWorkspaceState(activeWorkspaceId, (state) => ({
      ...state,
      treeLoading: true,
      treeError: null
    }));
    listFiles(activeWorkspaceId, '')
      .then((entries) => {
        updateWorkspaceState(activeWorkspaceId, (state) => ({
          ...state,
          tree: toTreeNodes(entries),
          treeLoading: false
        }));
      })
      .catch((error: unknown) => {
        updateWorkspaceState(activeWorkspaceId, (state) => ({
          ...state,
          treeLoading: false,
          treeError: getErrorMessage(error)
        }));
      });
  };

  const updateTreeNode = (
    nodes: FileTreeNode[],
    targetPath: string,
    updater: (node: FileTreeNode) => FileTreeNode
  ): FileTreeNode[] =>
    nodes.map((node) => {
      if (node.path === targetPath) {
        return updater(node);
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeNode(node.children, targetPath, updater)
        };
      }
      return node;
    });

  const handlePreviewRefresh = () => {
    if (!isWorkspaceModalOpen) return;
    setPreviewLoading(true);
    setPreviewError(null);
    previewFiles(previewRoot, '')
      .then((entries) => {
        setPreviewTree(toTreeNodes(entries));
        setPreviewLoading(false);
      })
      .catch((error: unknown) => {
        setPreviewError(getErrorMessage(error));
        setPreviewLoading(false);
      });
  };

  const handlePreviewToggleDir = (node: FileTreeNode) => {
    if (node.type !== 'dir') return;
    if (node.expanded) {
      setPreviewTree((prev) =>
        updateTreeNode(prev, node.path, (item) => ({
          ...item,
          expanded: false
        }))
      );
      return;
    }
    if (node.children && node.children.length > 0) {
      setPreviewTree((prev) =>
        updateTreeNode(prev, node.path, (item) => ({
          ...item,
          expanded: true
        }))
      );
      return;
    }
    setPreviewTree((prev) =>
      updateTreeNode(prev, node.path, (item) => ({
        ...item,
        loading: true
      }))
    );
    previewFiles(previewRoot, node.path)
      .then((entries) => {
        setPreviewTree((prev) =>
          updateTreeNode(prev, node.path, (item) => ({
            ...item,
            expanded: true,
            loading: false,
            children: toTreeNodes(entries)
          }))
        );
      })
      .catch((error: unknown) => {
        setPreviewError(getErrorMessage(error));
        setPreviewTree((prev) =>
          updateTreeNode(prev, node.path, (item) => ({
            ...item,
            loading: false
          }))
        );
      });
  };

  const handleToggleDir = (node: FileTreeNode) => {
    if (!activeWorkspaceId || node.type !== 'dir') return;
    if (node.expanded) {
      updateWorkspaceState(activeWorkspaceId, (state) => ({
        ...state,
        tree: updateTreeNode(state.tree, node.path, (item) => ({
          ...item,
          expanded: false
        }))
      }));
      return;
    }
    if (node.children && node.children.length > 0) {
      updateWorkspaceState(activeWorkspaceId, (state) => ({
        ...state,
        tree: updateTreeNode(state.tree, node.path, (item) => ({
          ...item,
          expanded: true
        }))
      }));
      return;
    }

    updateWorkspaceState(activeWorkspaceId, (state) => ({
      ...state,
      tree: updateTreeNode(state.tree, node.path, (item) => ({
        ...item,
        loading: true
      }))
    }));
    listFiles(activeWorkspaceId, node.path)
      .then((entries) => {
        updateWorkspaceState(activeWorkspaceId, (state) => ({
          ...state,
          tree: updateTreeNode(state.tree, node.path, (item) => ({
            ...item,
            expanded: true,
            loading: false,
            children: toTreeNodes(entries)
          }))
        }));
      })
      .catch((error: unknown) => {
        updateWorkspaceState(activeWorkspaceId, (state) => ({
          ...state,
          treeError: getErrorMessage(error),
          tree: updateTreeNode(state.tree, node.path, (item) => ({
            ...item,
            loading: false
          }))
        }));
      });
  };

  const handleOpenFile = (entry: FileTreeNode) => {
    if (!activeWorkspaceId || entry.type !== 'file') return;
    const existing = activeWorkspaceState.files.find(
      (file) => file.path === entry.path
    );
    if (existing) {
      updateWorkspaceState(activeWorkspaceId, (state) => ({
        ...state,
        activeFileId: existing.id
      }));
      return;
    }
    readFile(activeWorkspaceId, entry.path)
      .then((data) => {
        const file: EditorFile = {
          id: crypto.randomUUID(),
          name: entry.name,
          path: entry.path,
          language: getLanguageFromPath(entry.path),
          contents: data.contents,
          dirty: false
        };
        updateWorkspaceState(activeWorkspaceId, (state) => ({
          ...state,
          files: [...state.files, file],
          activeFileId: file.id
        }));
      })
      .catch((error: unknown) => {
        setStatusMessage(
          `\u30d5\u30a1\u30a4\u30eb\u3092\u958b\u3051\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      });
  };

  const handleFileChange = (fileId: string, contents: string) => {
    if (!activeWorkspaceId) return;
    updateWorkspaceState(activeWorkspaceId, (state) => ({
      ...state,
      files: state.files.map((file) =>
        file.id === fileId ? { ...file, contents, dirty: true } : file
      )
    }));
  };

  const handleSaveFile = async (fileId: string) => {
    if (!activeWorkspaceId) return;
    const file = activeWorkspaceState.files.find((item) => item.id === fileId);
    if (!file) return;
    setSavingFileId(fileId);
    try {
      await writeFile(activeWorkspaceId, file.path, file.contents);
      updateWorkspaceState(activeWorkspaceId, (state) => ({
        ...state,
        files: state.files.map((item) =>
          item.id === fileId ? { ...item, dirty: false } : item
        )
      }));
      setStatusMessage(SAVED_MESSAGE);
    } catch (error: unknown) {
      setStatusMessage(
        `\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${getErrorMessage(error)}`
      );
    } finally {
      setSavingFileId(null);
    }
  };

  const handleCreateTerminal = async () => {
    if (!activeDeckId) {
      setStatusMessage(
        '\u30c7\u30c3\u30ad\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002'
      );
      return;
    }
    try {
      const session = await apiCreateTerminal(activeDeckId);
      updateDeckState(activeDeckId, (state) => {
        const index = state.terminals.length + 1;
        const terminal = {
          id: session.id,
          title: `\u30bf\u30fc\u30df\u30ca\u30eb ${index}`
        };
        return {
          ...state,
          terminals: [...state.terminals, terminal],
          activeTerminalId: terminal.id
        };
      });
    } catch (error: unknown) {
      setStatusMessage(
        `\u30bf\u30fc\u30df\u30ca\u30eb\u3092\u8d77\u52d5\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
      );
    }
  };

  const handleSelectTerminal = (terminalId: string) => {
    if (!activeDeckId) return;
    updateDeckState(activeDeckId, (state) => ({
      ...state,
      activeTerminalId: terminalId
    }));
  };

  const handleSelectDeck = (deckId: string) => {
    setActiveDeckId(deckId);
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    setWorkspaceMode('editor');
  };

  const handleCloseWorkspaceEditor = () => {
    setWorkspaceMode('list');
  };

  const handleOpenWorkspaceModal = () => {
    setWorkspacePathDraft('');
    setIsWorkspaceModalOpen(true);
  };

  const handleSubmitWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    const created = await handleCreateWorkspace(workspacePathDraft);
    if (created) {
      setWorkspacePathDraft('');
      setIsWorkspaceModalOpen(false);
    }
  };

  const isWorkspaceEditorOpen =
    workspaceMode === 'editor' && Boolean(activeWorkspaceId);

  return (
    <div className="app" data-view={view}>
      <SideNav activeView={view} onSelect={setView} />
      <main className="main">
        {view === 'workspace' ? (
          <div className="workspace-view">
            <div className="workspace-start">
              <button
                type="button"
                className="primary-button"
                onClick={handleOpenWorkspaceModal}
              >
                {'\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u8ffd\u52a0'}
              </button>
              <WorkspaceList
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId}
                onSelect={handleSelectWorkspace}
              />
            </div>
            {isWorkspaceEditorOpen ? (
              <div className="workspace-editor-overlay">
                <div className="workspace-editor-header">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleCloseWorkspaceEditor}
                  >
                    {'\u4e00\u89a7\u306b\u623b\u308b'}
                  </button>
                  <div className="workspace-meta">
                    {activeWorkspace ? (
                      <span className="workspace-path">{activeWorkspace.path}</span>
                    ) : null}
                  </div>
                </div>
                <div className="workspace-editor-grid">
                  <FileTree
                      root={activeWorkspace?.path || defaultRoot || ''}
                    entries={activeWorkspaceState.tree}
                    loading={activeWorkspaceState.treeLoading}
                    error={activeWorkspaceState.treeError}
                    onToggleDir={handleToggleDir}
                    onOpenFile={handleOpenFile}
                    onRefresh={handleRefreshTree}
                  />
                  <EditorPane
                    files={activeWorkspaceState.files}
                    activeFileId={activeWorkspaceState.activeFileId}
                    onSelectFile={(fileId) => {
                      if (!activeWorkspaceId) return;
                      updateWorkspaceState(activeWorkspaceId, (state) => ({
                        ...state,
                        activeFileId: fileId
                      }));
                    }}
                    onChangeFile={handleFileChange}
                    onSaveFile={handleSaveFile}
                    savingFileId={savingFileId}
                  />
                </div>
              </div>
            ) : null}
            {isWorkspaceModalOpen ? (
              <div className="modal-backdrop" role="dialog" aria-modal="true">
                <form className="modal" onSubmit={handleSubmitWorkspace}>
                  <div className="modal-title">
                    {'\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u8ffd\u52a0'}
                  </div>
                  <label className="field">
                    <span>{'\u30d1\u30b9'}</span>
                    <input
                      type="text"
                      value={workspacePathDraft}
                      placeholder={defaultRoot || ''}
                      onChange={(event) =>
                        setWorkspacePathDraft(event.target.value)
                      }
                    />
                  </label>
                  <div className="modal-explorer">
                    <FileTree
                      root={previewRoot}
                      entries={previewTree}
                      loading={previewLoading}
                      error={previewError}
                      onToggleDir={handlePreviewToggleDir}
                      onOpenFile={() => undefined}
                      onRefresh={handlePreviewRefresh}
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setIsWorkspaceModalOpen(false)}
                    >
                      {'\u30ad\u30e3\u30f3\u30bb\u30eb'}
                    </button>
                    <button type="submit" className="primary-button">
                      {'\u8ffd\u52a0'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="terminal-layout">
            <DeckList
              decks={deckListItems}
              activeDeckId={activeDeckId}
              onSelect={handleSelectDeck}
              onCreate={() => handleCreateDeck(activeWorkspaceId)}
            />
            {activeDeckId ? (
              <TerminalPane
                terminals={activeDeckState.terminals}
                activeTerminalId={activeDeckState.activeTerminalId}
                wsBase={wsBase}
                onSelectTerminal={handleSelectTerminal}
                onNewTerminal={handleCreateTerminal}
              />
            ) : (
              <div className="panel empty-panel">
                {'\u30c7\u30c3\u30ad\u3092\u4f5c\u6210\u3057\u3066\u304f\u3060\u3055\u3044\u3002'}
              </div>
            )}
          </div>
        )}
      </main>
      {statusMessage ? (
        <div className="status-float" role="status">
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
}
