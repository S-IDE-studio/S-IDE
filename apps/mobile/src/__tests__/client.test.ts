import { describe, expect, test } from "vitest";
import { buildBasicAuthHeader, normalizeServerUrl, toWsBase } from "../api/client";

describe("mobile api client helpers", () => {
  test("normalizeServerUrl trims trailing slashes and dots", () => {
    expect(normalizeServerUrl("https://uuu.tail123.ts.net./")).toBe("https://uuu.tail123.ts.net");
    expect(normalizeServerUrl(" http://100.64.0.1:8787/// ")).toBe("http://100.64.0.1:8787");
  });

  test("toWsBase maps http(s) to ws(s)", () => {
    expect(toWsBase("http://example.com")).toBe("ws://example.com");
    expect(toWsBase("https://example.com")).toBe("wss://example.com");
  });

  test("buildBasicAuthHeader encodes user:pass", () => {
    expect(buildBasicAuthHeader("u", "p")).toBe("Basic dTpw");
  });
});

