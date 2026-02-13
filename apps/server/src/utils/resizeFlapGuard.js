const BLOCK_DURATION_MS = 30000;

function sameSize(a, b) {
  return Boolean(a && b && a.cols === b.cols && a.rows === b.rows);
}

export function createResizeFlapGuard() {
  return {
    lastApplied: null,
    previousApplied: null,
    blockedPair: null,
    blockedUntil: 0,
  };
}

export function shouldApplyResize(state, cols, rows, now = Date.now()) {
  const next = { cols, rows };

  if (sameSize(state.lastApplied, next)) {
    return false;
  }

  if (state.blockedPair && now < state.blockedUntil) {
    if (sameSize(state.blockedPair[0], next) || sameSize(state.blockedPair[1], next)) {
      return false;
    }
  }

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
