import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useIsMobile } from "@/hooks/use-mobile";
import { startDjenTermosScheduler, stopDjenTermosScheduler } from "@/hooks/useDjenTermosScheduler";


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
    // Processos scheduler: mesmo pattern — auto-inicia do DB se ativo
    void import('@/hooks/useDjenProcessosScheduler').then(m => m.getDjenProcessosSchedulerStatus());
    return () => {
      stopDjenTermosScheduler();
      // NÃO parar o scheduler Pro no unmount, para não persistir ativo=false ao fechar/reabrir navegador
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={`transition-all duration-300 ${isMobile ? 'ml-0' : 'lg:ml-64'} ${className || ''}`}>
        <Header title={title} subtitle={subtitle} headerActions={headerActions} />
        <main className="p-4 md:p-6 lg:max-h-[calc(100vh-64px)] lg:overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
