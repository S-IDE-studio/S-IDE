import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EditorPane } from "../../components/EditorPane";
import type { EditorFile, EditorGroup, GroupLayout } from "../../types";

// Mock Monaco Editor
vi.mock("@monaco-editor/react", () => ({
  default: () => null,
  __monaco_editor_react__: true,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  X: ({ className }: { className?: string }) => <span data-icon="X" className={className}>X</span>,
  Loader2: ({ className }: { className?: string }) => <span data-icon="Loader2" className={className}>Loader2</span>,
  Plus: ({ className }: { className?: string }) => <span data-icon="Plus" className={className}>Plus</span>,
  File: ({ className }: { className?: string }) => <span data-icon="File" className={className}>File</span>,
}));

// Mock @dnd-kit
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: (fn: unknown) => fn,
  useSensors: () => [],
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  rectSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => "",
    },
  },
}));

describe("EditorPane with Groups", () => {
  const mockFile: EditorFile = {
    id: "file-1",
    name: "test.ts",
    path: "/path/to/test.ts",
    language: "typescript",
    contents: "test content",
    dirty: false,
  };

  const mockFile2: EditorFile = {
    id: "file-2",
    name: "test2.ts",
    path: "/path/to/test2.ts",
    language: "typescript",
    contents: "test content 2",
    dirty: false,
  };

  const defaultProps = {
    files: [mockFile, mockFile2],
    activeFileId: "file-1",
    onSelectFile: vi.fn(),
    onCloseFile: vi.fn(),
    onChangeFile: vi.fn(),
    onSaveFile: vi.fn(),
    savingFileId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders single group layout by default", () => {
    render(<EditorPane {...defaultProps} />);
    expect(screen.getByText("test.ts")).toBeInTheDocument();
    expect(screen.getByText("test2.ts")).toBeInTheDocument();
  });

  it("renders multiple groups when provided with groupLayout", () => {
    const groups: EditorGroup[] = [
      {
        id: "group-1",
        tabs: [mockFile],
        activeTabId: "file-1",
        focused: true,
        percentage: 50,
      },
      {
        id: "group-2",
        tabs: [mockFile2],
        activeTabId: "file-2",
        focused: false,
        percentage: 50,
      },
    ];

    const groupLayout: GroupLayout = {
      direction: "horizontal",
      sizes: [50, 50],
    };

    render(<EditorPane {...defaultProps} editorGroups={groups} groupLayout={groupLayout} />);
    expect(screen.getByText("test.ts")).toBeInTheDocument();
    expect(screen.getByText("test2.ts")).toBeInTheDocument();
  });

  it("calls onSelectFile when tab is clicked", () => {
    render(<EditorPane {...defaultProps} />);
    const tab = screen.getByText("test.ts");
    fireEvent.click(tab);
    expect(defaultProps.onSelectFile).toHaveBeenCalledWith("file-1");
  });

  it("calls onCloseFile when close button is clicked", () => {
    render(<EditorPane {...defaultProps} />);
    const closeButton = screen.getAllByLabelText("閉じる")[0];
    fireEvent.click(closeButton);
    expect(defaultProps.onCloseFile).toHaveBeenCalledWith("file-1");
  });

  it("shows empty state when no files", () => {
    render(<EditorPane {...defaultProps} files={[]} activeFileId={null} />);
    expect(screen.getByText("ファイルを選択してください")).toBeInTheDocument();
  });

  it("shows saving indicator when file is being saved", () => {
    render(<EditorPane {...defaultProps} savingFileId="file-1" />);
    // The saving indicator is shown via the editor-tab-saving element with aria-label
    const savingIndicator = screen.getByLabelText("保存中");
    expect(savingIndicator).toBeInTheDocument();
  });

  it("shows dirty indicator for unsaved files", () => {
    const dirtyFile: EditorFile = {
      ...mockFile,
      dirty: true,
    };
    render(<EditorPane {...defaultProps} files={[dirtyFile]} />);
    const tabElement = screen.getByText("test.ts").closest(".editor-tab");
    expect(tabElement).toHaveClass("dirty");
  });

  it("applies active class to active tab", () => {
    render(<EditorPane {...defaultProps} activeFileId="file-1" />);
    const activeTab = screen.getByText("test.ts").closest(".editor-tab");
    expect(activeTab).toHaveClass("active");
  });
});
