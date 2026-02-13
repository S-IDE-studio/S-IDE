type TerminalSender = (payload: string) => boolean;

const terminalSenders = new Map<string, TerminalSender>();
let activeTerminalId: string | null = null;

export function registerTerminalSender(terminalId: string, sender: TerminalSender): () => void {
  terminalSenders.set(terminalId, sender);
  return () => {
    const current = terminalSenders.get(terminalId);
    if (current === sender) {
      terminalSenders.delete(terminalId);
    }
  };
}

export function setActiveTerminalId(terminalId: string | null): void {
  activeTerminalId = terminalId;
}

export function getActiveTerminalId(): string | null {
  return activeTerminalId;
}

export function sendToTerminal(terminalId: string, payload: string): boolean {
  const sender = terminalSenders.get(terminalId);
  if (!sender) return false;
  return sender(payload);
}

export function sendToActiveTerminal(payload: string): boolean {
  if (!activeTerminalId) return false;
  return sendToTerminal(activeTerminalId, payload);
}
