export async function openExternalUrl(url: string): Promise<void> {
  // Prefer Tauri shell open (works reliably in Desktop where window.open is often blocked).
  // We use the global __TAURI__ API to avoid adding a new JS dependency.
  const tauri = (window as any)?.__TAURI__;
  const shellOpen = tauri?.shell?.open as ((url: string) => Promise<void> | void) | undefined;
  if (typeof shellOpen === "function") {
    await shellOpen(url);
    return;
  }

  // Web fallback.
  window.open(url, "_blank");
}

