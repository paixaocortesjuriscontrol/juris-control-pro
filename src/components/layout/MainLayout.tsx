import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useIsMobile } from "@/hooks/use-mobile";
import { startDjenTermosScheduler, stopDjenTermosScheduler } from "@/hooks/useDjenTermosScheduler";
import { startDjenTermosProScheduler, stopDjenTermosProScheduler } from "@/hooks/useDjenTermosProScheduler";

export interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  className?: string;
}

export function MainLayout({ children, title, subtitle, headerActions, className }: MainLayoutProps) {
  const isMobile = useIsMobile();

  // Inicializa os schedulers de DJEN Termos e Termos Pro
  // O Pro scheduler carrega automaticamente do DB no construtor e auto-inicia se ativo
  useEffect(() => {
    if (localStorage.getItem('djen-termos-scheduler-enabled') === 'true') {
      startDjenTermosScheduler();
    }
    // Pro scheduler: apenas instancia — ele auto-inicia do DB se ativo
    // Isso garante que a instância singleton seja criada
    void import('@/hooks/useDjenTermosProScheduler').then(m => m.getDjenTermosProSchedulerStatus());
    return () => {
      stopDjenTermosScheduler();
      stopDjenTermosProScheduler();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={`transition-all duration-300 ${isMobile ? 'ml-0' : 'md:ml-64'} ${className || ''}`}>
        <Header title={title} subtitle={subtitle} headerActions={headerActions} />
        {/*
          Mobile: deixar o body controlar o scroll (evita conflitos de gesto com scroll horizontal aninhado).
          Desktop: mantém container interno com altura fixa.
        */}
        <main className="p-4 md:p-6 md:max-h-[calc(100vh-64px)] md:overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
