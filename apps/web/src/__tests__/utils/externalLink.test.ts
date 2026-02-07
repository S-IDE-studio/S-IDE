import { describe, expect, it, vi } from "vitest";
import { openExternalUrl } from "../../utils/externalLink";

describe("openExternalUrl", () => {
  it("uses window.open when not in Tauri", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);

    await openExternalUrl("https://example.com/");

    expect(openSpy).toHaveBeenCalledWith("https://example.com/", "_blank");
  });

  it("uses __TAURI__.shell.open when available", async () => {
    const shellOpen = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("__TAURI__", { shell: { open: shellOpen } } as any);

    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);

    await openExternalUrl("https://example.com/");

    expect(shellOpen).toHaveBeenCalledWith("https://example.com/");
    expect(openSpy).not.toHaveBeenCalled();
  });
});
