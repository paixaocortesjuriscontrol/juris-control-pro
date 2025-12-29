import React, { createContext, useContext, useState, useCallback } from "react";

interface ImportContextType {
  activeImports: number;
  importLabel: string | null;
  startImport: (label?: string) => void;
  endImport: () => void;
  isImporting: boolean;
}

const ImportContext = createContext<ImportContextType | undefined>(undefined);

export function ImportProvider({ children }: { children: React.ReactNode }) {
  const [activeImports, setActiveImports] = useState(0);
  const [importLabel, setImportLabel] = useState<string | null>(null);

  const startImport = useCallback((label?: string) => {
    setActiveImports((prev) => prev + 1);
    if (label) setImportLabel(label);
  }, []);

  const endImport = useCallback(() => {
    setActiveImports((prev) => {
      const next = Math.max(0, prev - 1);
      if (next === 0) setImportLabel(null);
      return next;
    });
  }, []);

  return (
    <ImportContext.Provider
      value={{
        activeImports,
        importLabel,
        startImport,
        endImport,
        isImporting: activeImports > 0,
      }}
    >
      {children}
    </ImportContext.Provider>
  );
}

export function useImport() {
  const context = useContext(ImportContext);
  if (context === undefined) {
    throw new Error("useImport must be used within an ImportProvider");
  }
  return context;
}
