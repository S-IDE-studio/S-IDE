import { describe, expect, it } from "vitest";
import { resolveApiBase } from "../../utils/apiBase";

describe("resolveApiBase", () => {
  it("returns empty base when configured base points to localhost but current host is remote", () => {
    expect(resolveApiBase("http://localhost:8787", "100.64.12.34")).toBe("");
    expect(resolveApiBase("http://127.0.0.1:8787", "home-pc.tailnet-123.ts.net")).toBe("");
  });

  it("keeps empty base as empty", () => {
    expect(resolveApiBase("", "100.64.12.34")).toBe("");
  });

  it("keeps non-localhost configured base", () => {
    expect(resolveApiBase("https://example.com/api", "100.64.12.34")).toBe("https://example.com/api");
  });

  it("keeps localhost base when current host is localhost", () => {
    expect(resolveApiBase("http://localhost:8787", "localhost")).toBe("http://localhost:8787");
  });
});

