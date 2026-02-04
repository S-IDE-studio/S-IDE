import { File as FileIcon } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { EDITOR_FONT_FAMILY, EDITOR_FONT_SIZE } from "../../constants";
import type { EditorFile, EditorGroup } from "../../types";
import { EditorTabList } from "./EditorTabList";

interface EditorGroupContainerProps {
  group: EditorGroup;
  isFocused: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onChangeTab: (tabId: string, contents: string) => void;
  onSaveTab?: (tabId: string) => void;
  savingTabId: string | null;
  onFocus: () => void;
  onTabsReorder?: (tabs: EditorFile[]) => void;
}

const LABEL_EMPTY = "ファイルを選択してください";
const MONACO_THEME = "vs-dark";

export function EditorGroupContainer({
  group,
  isFocused,
  onSelectTab,
  onCloseTab,
  onChangeTab,
  onSaveTab,
  savingTabId,
  onFocus,
}: EditorGroupContainerProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const cursorPositionRef = useRef({ line: 1, column: 1 });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const activeFile = group.tabs.find((tab) => tab.id === group.activeTabId);

  // Delay editor rendering until container has proper dimensions
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
    });
    return () => cancelAnimationFrame(timer);
  }, [group.activeTabId]);

  const handleEditorMount: OnMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          editor.layout();
        } catch {
          // Ignore layout errors during initialization
        }
      });
    });
    resizeObserverRef.current = resizeObserver;
    const container = editor.getContainerDomNode();
    if (container?.parentElement) {
      resizeObserver.observe(container.parentElement);
    }

    editor.onDidChangeCursorPosition((e) => {
      cursorPositionRef.current = {
        line: e.position.lineNumber,
        column: e.position.column,
      };
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeFile) return;
      const isSave = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
      if (!isSave) return;
      event.preventDefault();
      onSaveTab?.(activeFile.id);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFile, onSaveTab]);

  // Focus group on click
  const handleContainerClick = useCallback(() => {
    onFocus();
  }, [onFocus]);

  // Empty state
  if (group.tabs.length === 0) {
    return (
      <div
        className={`editor-group-container ${isFocused ? "focused" : ""}`}
        onClick={handleContainerClick}
      >
        <div className="editor-container editor-empty">
          <div className="editor-welcome">
            <div className="editor-welcome-icon">
              <FileIcon size={48} />
            </div>
            <div className="editor-welcome-text">{LABEL_EMPTY}</div>
            <div className="editor-welcome-hint">ファイルを開いてください</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`editor-group-container ${isFocused ? "focused" : ""}`}
      onClick={handleContainerClick}
    >
      {/* Tab Bar */}
      <EditorTabList
        tabs={group.tabs}
        activeTabId={group.activeTabId}
        onTabSelect={onSelectTab}
        onTabClose={onCloseTab}
        savingFileId={savingTabId}
        isDraggable={false}
      />

      {/* Breadcrumb */}
      {activeFile && (
        <div className="editor-breadcrumb">
          <span className="editor-breadcrumb-path">{activeFile.path}</span>
        </div>
      )}

      {/* Editor Content */}
      <div className="editor-content">
        {activeFile ? (
          <div style={{ height: "100%", width: "100%", overflow: "hidden" }}>
            {isEditorReady ? (
              <Editor
                key={activeFile.id}
                height="100%"
                width="100%"
                theme={MONACO_THEME}
                language={activeFile.language}
                value={activeFile.contents}
                onChange={(value) => onChangeTab(activeFile.id, value ?? "")}
                onMount={handleEditorMount}
                options={{
                  fontFamily: EDITOR_FONT_FAMILY,
                  fontSize: EDITOR_FONT_SIZE,
                  fontLigatures: true,
                  minimap: { enabled: false },
                  smoothScrolling: false,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  renderLineHighlight: "all",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 8, bottom: 8 },
                  lineNumbers: "on",
                  renderWhitespace: "selection",
                  bracketPairColorization: { enabled: true },
                  guides: {
                    bracketPairs: true,
                    indentation: true,
                  },
                  scrollbar: {
                    useShadows: false,
                    vertical: "auto",
                    horizontal: "auto",
                  },
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--ink-muted)",
                }}
              >
                エディターを初期化中...
              </div>
            )}
          </div>
        ) : (
          <div className="editor-no-file">
            <span>{LABEL_EMPTY}</span>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {activeFile && (
        <div className="editor-statusbar">
          <div className="editor-statusbar-left">
            {/* TODO: Git branch info */}
          </div>
          <div className="editor-statusbar-right">
            <span className="editor-status-item">
              Ln {cursorPositionRef.current.line}, Col {cursorPositionRef.current.column}
            </span>
            <span className="editor-status-item">UTF-8</span>
            <span className="editor-status-item">{activeFile.language}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const MemoizedEditorGroupContainer = memo(EditorGroupContainer);
