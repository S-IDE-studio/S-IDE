import { describe, expect, it } from "vitest";
import { createResizeFlapGuard, shouldApplyResize } from "../../utils/resizeFlapGuard.js";

describe("resizeFlapGuard", () => {
  it("allows first resize and blocks rapid A/B alternating loop", () => {
    const guard = createResizeFlapGuard();

    expect(shouldApplyResize(guard, 117, 82, 1000)).toBe(true);
    expect(shouldApplyResize(guard, 115, 81, 1100)).toBe(true);
    expect(shouldApplyResize(guard, 117, 82, 1200)).toBe(false);
    expect(shouldApplyResize(guard, 115, 81, 1300)).toBe(false);
  });

  it("allows a new size that is not part of blocked flap pair", () => {
    const guard = createResizeFlapGuard();

    expect(shouldApplyResize(guard, 117, 82, 1000)).toBe(true);
    expect(shouldApplyResize(guard, 115, 81, 1100)).toBe(true);
    expect(shouldApplyResize(guard, 117, 82, 1200)).toBe(false);
    expect(shouldApplyResize(guard, 120, 84, 1300)).toBe(true);
  });
});
