export interface ResizeSize {
  cols: number;
  rows: number;
}

export interface ResizeGuardState {
  pendingStable: ResizeSize | null;
  previousSent: ResizeSize | null;
  lastSent: ResizeSize | null;
  lastSentAt: number;
  blockedPair: [ResizeSize, ResizeSize] | null;
  blockedUntil: number;
}

const DEFAULT_BLOCK_DURATION_MS = 2000;
const DEFAULT_MIN_INTERVAL_MS = 60;

function isSameSize(a: ResizeSize | null, b: ResizeSize | null): boolean {
  return Boolean(a && b && a.cols === b.cols && a.rows === b.rows);
}

function isBlockedPair(state: ResizeGuardState, next: ResizeSize, now: number): boolean {
  if (!state.blockedPair || now >= state.blockedUntil) {
    return false;
  }
  return isSameSize(state.blockedPair[0], next) || isSameSize(state.blockedPair[1], next);
}

export function createResizeGuardState(): ResizeGuardState {
  return {
    pendingStable: null,
    previousSent: null,
    lastSent: null,
    lastSentAt: 0,
    blockedPair: null,
    blockedUntil: 0,
  };
}

export function shouldEmitResize(
  state: ResizeGuardState,
  next: ResizeSize,
  options: {
    force?: boolean;
    now?: number;
    minIntervalMs?: number;
    blockDurationMs?: number;
  } = {}
): boolean {
  const force = Boolean(options.force);
  const now = options.now ?? Date.now();
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const blockDurationMs = options.blockDurationMs ?? DEFAULT_BLOCK_DURATION_MS;

  if (!force) {
    if (!isSameSize(state.pendingStable, next)) {
      state.pendingStable = next;
      return false;
    }
  }

  state.pendingStable = null;

  if (isBlockedPair(state, next, now)) {
    return false;
  }

  if (isSameSize(state.lastSent, next)) {
    return false;
  }

  if (!force && state.lastSentAt > 0 && now - state.lastSentAt < minIntervalMs) {
    return false;
  }

  // Detect A -> B -> A oscillation and block both sizes for a short cooldown.
  if (
    state.previousSent &&
    state.lastSent &&
    isSameSize(state.previousSent, next) &&
    !isSameSize(state.lastSent, next)
  ) {
    state.blockedPair = [state.previousSent, state.lastSent];
    state.blockedUntil = now + blockDurationMs;
    return false;
  }

  state.previousSent = state.lastSent;
  state.lastSent = next;
  state.lastSentAt = now;
  state.blockedPair = null;
  state.blockedUntil = 0;
  return true;
}
