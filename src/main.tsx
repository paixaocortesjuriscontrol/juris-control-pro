import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundaryFallback } from "@/components/ErrorBoundaryFallback";
import "./index.css";

// Após nova publicação, arquivos antigos deixam de existir: recarrega uma vez para pegar a versão nova.
window.addEventListener("vite:preloadError", (event) => {
  const chave = "recarregou-apos-nova-versao";
  const ultimo = Number(sessionStorage.getItem(chave) || 0);
  if (Date.now() - ultimo > 30000) {
    event.preventDefault();
    sessionStorage.setItem(chave, String(Date.now()));
    window.location.reload();
  }
});

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado.");

createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundaryFallback>
      <App />
    </ErrorBoundaryFallback>
  </React.StrictMode>
);