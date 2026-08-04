import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MonitoramentosFloatingIndicator } from "./MonitoramentosFloatingIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebarCollapsed } from "@/contexts/SidebarContext";
import { startDjenTermosScheduler, stopDjenTermosScheduler } from "@/hooks/useDjenTermosScheduler";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import { allMenuItems } from "@/config/menuItems";


export interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  className?: string;
}

export function MainLayout({ children, title, subtitle, headerActions, className }: MainLayoutProps) {
  const isMobile = useIsMobile();
  const { collapsed } = useSidebarCollapsed();
  const location = useLocation();
  const { isMenuAllowed, isLoading: loadingPermissoes } = useMenuPermissions();

  // Inicializa os schedulers de DJEN Termos e Termos Pro
  // O Pro scheduler carrega automaticamente do DB no construtor e auto-inicia se ativo
  useEffect(() => {
    if (localStorage.getItem('djen-termos-scheduler-enabled') === 'true') {
      startDjenTermosScheduler();
    }
    // Processos scheduler: mesmo pattern — auto-inicia do DB se ativo
    void import('@/hooks/useDjenProcessosScheduler').then(m => m.getDjenProcessosSchedulerStatus());
    // Paralela scheduler: mesmo pattern — auto-inicia do DB se ativo
    void import('@/hooks/useDjenTermosParalelaScheduler').then(m => m.getDjenTermosParalelaSchedulerStatus());
    // DJET Pautas scheduler: mesmo pattern — auto-inicia do DB se ativo
    void import('@/hooks/useDjetPautasParalelaScheduler').then(m => m.getDjetPautasParalelaSchedulerStatus());
    return () => {
      stopDjenTermosScheduler();
      // NÃO parar o scheduler Pro no unmount, para não persistir ativo=false ao fechar/reabrir navegador
    };
  }, []);

  // Guarda de rota: bloqueia acesso direto a telas desmarcadas no Nível de Acesso
  const matchedMenu = allMenuItems.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
  );
  if (!loadingPermissoes && matchedMenu && !isMenuAllowed(matchedMenu.path)) {
    return <Navigate to={matchedMenu.path === "/painel-controle" ? "/" : "/painel-controle"} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={`min-w-0 overflow-x-hidden transition-all duration-300 ${isMobile ? 'ml-0' : collapsed ? 'lg:ml-20' : 'lg:ml-64'} ${className || ''}`}>
        <Header title={title} subtitle={subtitle} headerActions={headerActions} />
        <main data-page-scroll-container className="min-w-0 p-4 md:p-6 lg:max-h-[calc(100vh-64px)] lg:overflow-y-auto">
          {children}
        </main>
      </div>
      <MonitoramentosFloatingIndicator />
    </div>
  );
}
