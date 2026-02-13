import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProviders } from "./components/AppProviders";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

async function clearStaleServiceWorkers(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn("[web] Failed to unregister service workers", error);
  }

  if (!("caches" in window)) {
    return;
  }

  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.includes("workbox") || key.includes("precache"))
        .map((key) => caches.delete(key))
    );
  } catch (error) {
    console.warn("[web] Failed to clear service worker caches", error);
  }
}

void clearStaleServiceWorkers();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </React.StrictMode>
);
