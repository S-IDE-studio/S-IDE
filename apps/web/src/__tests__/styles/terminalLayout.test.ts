import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const stylesPath = path.resolve(process.cwd(), "src/styles.css");

function getStylesCss(): string {
  return fs.readFileSync(stylesPath, "utf-8");
}

describe("terminal layout stability", () => {
  it("does not apply padding to xterm-screen to avoid fit/resize oscillation", () => {
    const css = getStylesCss();
    expect(css).toMatch(/\.terminal-panel-content\s+\.xterm-screen\s*\{[^}]*padding:\s*0/s);
  });

  it("keeps dockview tab header before content container", () => {
    const css = getStylesCss();
    expect(css).toMatch(
      /\.dockview-theme-side\s+\.dv-groupview\s*>\s*\.dv-tabs-and-actions-container\s*\{[^}]*order:\s*0/s
    );
    expect(css).toMatch(
      /\.dockview-theme-side\s+\.dv-groupview\s*>\s*\.dv-content-container\s*\{[^}]*order:\s*1/s
    );
  });

  it("does not hide hamburger menu in mobile title bar mode", () => {
    const css = getStylesCss();
    expect(css).toMatch(
      /\.title-bar--mobile\s+\.title-bar-menu--hamburger\s*\{[^}]*display:\s*flex/s
    );
  });
});
