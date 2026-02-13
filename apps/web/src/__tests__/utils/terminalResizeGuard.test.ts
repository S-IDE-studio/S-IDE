import { describe, expect, it } from "vitest";
import {
  createResizeGuardState,
  type ResizeGuardState,
  shouldEmitResize,
} from "../../utils/terminalResizeGuard";

function freshState(): ResizeGuardState {
  return createResizeGuardState();
}

describe("terminalResizeGuard", () => {
  it("requires stable size before sending non-forced resize", () => {
    const state = freshState();
    const size = { cols: 80, rows: 24 };

    expect(shouldEmitResize(state, size, { force: false, now: 1000 })).toBe(false);
    expect(shouldEmitResize(state, size, { force: false, now: 1100 })).toBe(true);
  });

  it("suppresses duplicate resize payloads", () => {
    const state = freshState();
    const size = { cols: 90, rows: 30 };

    expect(shouldEmitResize(state, size, { force: true, now: 1000 })).toBe(true);
    expect(shouldEmitResize(state, size, { force: true, now: 1100 })).toBe(false);
  });

  it("blocks oscillating A/B/A resize loop for a cooldown period", () => {
    const state = freshState();
    const a = { cols: 47, rows: 81 };
    const b = { cols: 49, rows: 82 };
    const c = { cols: 50, rows: 83 };

    expect(shouldEmitResize(state, a, { force: true, now: 1000 })).toBe(true);
    expect(shouldEmitResize(state, b, { force: true, now: 1200 })).toBe(true);
    expect(shouldEmitResize(state, a, { force: true, now: 1400 })).toBe(false);
    expect(shouldEmitResize(state, b, { force: true, now: 1500 })).toBe(false);

    expect(shouldEmitResize(state, b, { force: true, now: 3500 })).toBe(false);
    expect(shouldEmitResize(state, c, { force: true, now: 3600 })).toBe(true);
  });
});
