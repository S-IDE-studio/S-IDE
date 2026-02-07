const STORAGE_KEY = "side-ide:tabs-sync:client-id";

function fallbackId(): string {
  // Reasonably unique for a single browser profile.
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateTabsSyncClientId(): string {
  if (typeof window === "undefined") return fallbackId();

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackId();
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return fallbackId();
  }
}

