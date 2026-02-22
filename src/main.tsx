import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundaryFallback } from "@/components/ErrorBoundaryFallback";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado.");

createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundaryFallback>
      <App />
    </ErrorBoundaryFallback>
  </React.StrictMode>
);