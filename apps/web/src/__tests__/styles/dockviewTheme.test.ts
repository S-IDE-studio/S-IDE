import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dockviewThemePath = path.resolve(process.cwd(), "src/components/dockview/dockview-theme.css");

function getDockviewThemeCss(): string {
  return fs.readFileSync(dockviewThemePath, "utf-8");
}

describe("dockview tab line styling", () => {
  it("does not add top border to active tab", () => {
    const css = getDockviewThemeCss();
    expect(css).not.toMatch(
      /\.dockview-theme-side\s+\.dv-tab\.active,\s*\.dockview-theme-side\s+\.dv-tab\.dv-active-tab\s*\{[^}]*border-top\s*:\s*[1-9]\d*px[^;}]*;/s
    );
  });

  it("hides horizontal tab divider pseudo element", () => {
    const css = getDockviewThemeCss();
    expect(css).toMatch(
      /\.dockview-theme-side\s+\.dv-tabs-container\.dv-horizontal\s+\.dv-tab:not\(:first-child\)::before\s*\{[^}]*display:\s*none/s
    );
  });

  it("disables dockview focus overlay line on tabs", () => {
    const css = getDockviewThemeCss();
    expect(css).toMatch(
      /\.dockview-theme-side\s+\.dv-tab:focus-within::after,\s*\.dockview-theme-side\s+\.dv-tab:focus::after\s*\{[^}]*display:\s*none[^}]*outline:\s*none\s*!important/s
    );
  });

  it("disables legacy inner panel-tab top border inside dockview", () => {
    const css = getDockviewThemeCss();
    expect(css).toMatch(
      /\.dockview-theme-side\s+\.panel-tab,\s*\.dockview-theme-side\s+\.panel-tab:hover,\s*\.dockview-theme-side\s+\.panel-tab\.active\s*\{[^}]*border-top:\s*0\s*!important/s
    );
  });
});
