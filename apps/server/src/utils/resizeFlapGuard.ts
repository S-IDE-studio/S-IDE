export interface ResizeFlapState {
  lastApplied: { cols: number; rows: number } | null;
  previousApplied: { cols: number; rows: number } | null;
  blockedPair: [{ cols: number; rows: number }, { cols: number; rows: number }] | null;
  blockedUntil: number;
}

const BLOCK_DURATION_MS = 30000;

function sameSize(
  a: { cols: number; rows: number } | null,
  b: { cols: number; rows: number } | null
): boolean {
  return Boolean(a && b && a.cols === b.cols && a.rows === b.rows);
}

export function createResizeFlapGuard(): ResizeFlapState {
  return {
    lastApplied: null,
    previousApplied: null,
    blockedPair: null,
    blockedUntil: 0,
  };
}

export function shouldApplyResize(
  state: ResizeFlapState,
  cols: number,
  rows: number,
  now = Date.now()
): boolean {
  const next = { cols, rows };

  if (sameSize(state.lastApplied, next)) {
    return false;
  }

  // If currently blocked, ignore the same A/B oscillation pair.
  if (state.blockedPair && now < state.blockedUntil) {
    if (sameSize(state.blockedPair[0], next) || sameSize(state.blockedPair[1], next)) {
      return false;
    }
  }

  // Detect A -> B -> A oscillation and block both states for a while.
  if (
    state.previousApplied &&
    state.lastApplied &&
    sameSize(state.previousApplied, next) &&
    !sameSize(state.lastApplied, next)
  ) {
    state.blockedPair = [state.previousApplied, state.lastApplied];
    state.blockedUntil = now + BLOCK_DURATION_MS;
    return false;
  }

  state.previousApplied = state.lastApplied;
  state.lastApplied = next;
  return true;
}
