import { expect, test } from "vitest";
import { buildRemoteAccessUrl, pickRemoteAccessHost } from "../utils/remoteAccess";

test("pickRemoteAccessHost prefers dnsName over ips", () => {
  const host = pickRemoteAccessHost({
    dnsName: "home-pc.tailnet-123.ts.net",
    ips: ["100.64.12.34"],
  });
  expect(host).toBe("home-pc.tailnet-123.ts.net");
});

test("pickRemoteAccessHost trims trailing dot", () => {
  const host = pickRemoteAccessHost({
    dnsName: "uuu.tailnet-123.ts.net.",
    ips: ["100.64.12.34"],
  });
  expect(host).toBe("uuu.tailnet-123.ts.net");
});

test("pickRemoteAccessHost falls back to first ip", () => {
  const host = pickRemoteAccessHost({
    dnsName: null,
    ips: ["100.64.12.34", "fd7a::1"],
  });
  expect(host).toBe("100.64.12.34");
});

test("buildRemoteAccessUrl adds port and http scheme", () => {
  const url = buildRemoteAccessUrl({ host: "100.64.12.34", port: 8787 });
  expect(url).toBe("http://100.64.12.34:8787");
});

test("buildRemoteAccessUrl supports https without port", () => {
  const url = buildRemoteAccessUrl({
    host: "uuu.tailnet-123.ts.net",
    port: 443,
    scheme: "https",
    omitPort: true,
  });
  expect(url).toBe("https://uuu.tailnet-123.ts.net");
});
