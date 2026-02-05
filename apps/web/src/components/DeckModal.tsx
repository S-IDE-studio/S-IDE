import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Deck, Workspace } from "../types";

interface DeckModalProps {
  isOpen: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  existingDecks: Deck[];
  onSubmit: (name: string, workspaceId: string) => Promise<void>;
  onClose: () => void;
}

export const DeckModal = ({
  isOpen,
  workspaces,
  activeWorkspaceId,
  existingDecks,
  onSubmit,
  onClose,
}: DeckModalProps) => {
  const [deckWorkspaceId, setDeckWorkspaceId] = useState("");
  const [deckNameDraft, setDeckNameDraft] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Calculate next deck number for a workspace
  const getNextDeckNumber = useMemo(
    () => (workspaceId: string) => {
      const workspaceDecks = existingDecks.filter((d) => d.workspaceId === workspaceId);
      const existingNumbers = workspaceDecks
        .map((d) => {
          const match = d.name.match(/^Deck\s+(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);
      const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      return maxNumber + 1;
    },
    [existingDecks]
  );

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen) return;

    // Focus first input when modal opens
    firstInputRef.current?.focus();

    // Handle tab key for focus trap
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements =
        modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) || [];

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleTabKey);
    document.addEventListener("keydown", handleEscape);

    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleTabKey);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Set default workspace and deck name when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Use active workspace if available, otherwise use first workspace
    const defaultWorkspaceId = activeWorkspaceId || workspaces[0]?.id || "";
    setDeckWorkspaceId(defaultWorkspaceId);

    // Set default deck name based on workspace
    const nextNumber = getNextDeckNumber(defaultWorkspaceId);
    setDeckNameDraft(`Deck ${nextNumber}`);
  }, [isOpen, activeWorkspaceId, workspaces, getNextDeckNumber]);

  // Update deck name when workspace changes
  useEffect(() => {
    if (!isOpen || !deckWorkspaceId) return;

    // Only update if the current name is in the "Deck N" format
    const currentMatch = deckNameDraft.match(/^Deck\s+(\d+)$/);
    if (currentMatch) {
      const nextNumber = getNextDeckNumber(deckWorkspaceId);
      setDeckNameDraft(`Deck ${nextNumber}`);
    }
  }, [deckWorkspaceId, isOpen, getNextDeckNumber, deckNameDraft]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // Validate: workspace must be selected
    if (!deckWorkspaceId) {
      return;
    }

    await onSubmit(deckNameDraft.trim(), deckWorkspaceId);
    setDeckNameDraft("");
    setDeckWorkspaceId("");
  };

  const isFormValid = deckNameDraft.trim().length > 0 && deckWorkspaceId;

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" ref={modalRef}>
      <form className="modal" onSubmit={handleSubmit} ref={formRef}>
        <div className="modal-title">デッキ作成</div>
        <label className="field">
          <span>デッキ名 (任意)</span>
          <input
            ref={firstInputRef}
            type="text"
            value={deckNameDraft}
            placeholder="空白の場合は自動で設定されます"
            onChange={(event) => setDeckNameDraft(event.target.value)}
          />
        </label>
        <label className="field">
          <span>ワークスペース *</span>
          <select
            value={deckWorkspaceId}
            onChange={(event) => setDeckWorkspaceId(event.target.value)}
            required
          >
            <option value="">選択してください</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="primary-button" disabled={!isFormValid}>
            作成
          </button>
        </div>
      </form>
    </div>
  );
};
