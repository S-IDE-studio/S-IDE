import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProviders } from "./components/AppProviders";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

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
