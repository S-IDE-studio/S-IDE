import { describe, expect, it } from "vitest";
import {
  computeVisibleMenuCount,
  getStatusBarDensity,
  type StatusBarDensity,
} from "../../utils/layoutCompaction";

describe("layoutCompaction", () => {
  it("keeps all menus visible when enough width exists", () => {
    const visible = computeVisibleMenuCount([44, 72, 56, 48], 260, 40);
    expect(visible).toBe(4);
  });

  it("reserves space for --- overflow and collapses tail items", () => {
    const visible = computeVisibleMenuCount([44, 72, 56, 48], 180, 40);
    expect(visible).toBe(2);
  });

  it("returns compact density below desktop breakpoint", () => {
    const density: StatusBarDensity = getStatusBarDensity(1100);
    expect(density).toBe("compact");
  });

  it("returns minimal density below tablet breakpoint", () => {
    const density: StatusBarDensity = getStatusBarDensity(840);
    expect(density).toBe("minimal");
  });
});
