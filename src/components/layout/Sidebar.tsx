import { useState } from "react";
import { APP_VERSION } from "@/constants/version";
import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Scale, 
  Users, 
  FileText, 
  Search, 
  BarChart3, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  Upload,
  Menu,
  X,
  Calendar,
  Clock,
  Newspaper,
  UserCircle,
  Radar,
  FolderOpen,
  Bell,
  ClipboardList,
  Brain,
  Library,
  FileWarning,
  BookOpen,
  LayoutPanelTop,
  Table2,
  ArrowRightLeft,
  KeyRound,
  Sparkles,
  Mail,
  Server,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarCollapsed } from "@/contexts/SidebarContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import { useMensagensNaoLidas } from "@/hooks/useMensagensNaoLidas";
import { useMonitoramentoCounts } from "@/hooks/useMonitoramentoCounts";
import { menuItemsPublicos, menuItemsAdmin, type MenuItem } from "@/config/menuItems";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const { collapsed, setCollapsed } = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAdmin, isAdminOrCoordinator, role } = useUserRole();
  const { coordenacoes: minhasCoordenacoes } = useCoordenacoesDoUsuario();
  const { isMenuAllowed } = useMenuPermissions();
  const { totalNaoLidas } = useMensagensNaoLidas();
  const { movimentacoes: totalMonitoramento } = useMonitoramentoCounts();
  const nomesCoordenacoes = new Set((minhasCoordenacoes || []).map((c) => c.nome));
  const isAdvogadoTemporario = role === "advogado_temporario";

  // Advogado Temporário (perfil de conferência) vê Análise DJEN e Comparar DJEN
  const allowedForTemporario = new Set(["/analise-djen", "/comparar-dj-santander", "/errata-djen"]);

  const visiblePublicos = isAdvogadoTemporario
    ? menuItemsPublicos.filter((item) => allowedForTemporario.has(item.path))
    : menuItemsPublicos.filter(
        (item) =>
          (!item.adminOnly || isAdmin) &&
          (!item.adminOrCoordOnly || isAdminOrCoordinator) &&
          (!item.restrictedCoordenacoes || isAdmin || item.restrictedCoordenacoes.some((n) => nomesCoordenacoes.has(n)))
      );


  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold to-gold-light flex items-center justify-center shadow-gold flex-shrink-0">
            <Scale className="w-5 h-5 text-navy-deep" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="font-serif text-lg font-bold text-sidebar-foreground">Juris Control</h1>
              <p className="text-xs text-sidebar-foreground/60">Paixão Cortes Advogados</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-600 text-white font-serif text-[11px] font-semibold shadow-sm">
                  v{APP_VERSION}
                </span>
                {totalNaoLidas > 0 && (
                  <NavLink
                    to="/painel-controle?view=notificacoes"
                    title={`${totalNaoLidas} mensagem(ns) não lida(s)`}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold shadow-sm"
                  >
                    {totalNaoLidas} não lidas
                  </NavLink>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 lg:py-6 px-2 lg:px-3 space-y-1 overflow-y-auto">
        {[
          ...visiblePublicos,
          ...(isAdminOrCoordinator && !isAdvogadoTemporario
            ? menuItemsAdmin.filter((item) => !item.adminOnly || isAdmin)
            : []),
        ]
          .filter((item) => isMenuAllowed(item.path))
          .map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "nav-item relative",
                isActive && "nav-item-active",
                item.highlight && "text-amber-400",
                item.color
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            {item.path === "/monitoramento" && totalMonitoramento > 0 && (
              <span
                title={`${totalMonitoramento} novidade(s) de monitoramento`}
                className={cn(
                  "inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none",
                  collapsed ? "absolute top-1 right-1 h-4 min-w-4 px-1" : "ml-auto h-5 min-w-5 px-1.5"
                )}
              >
                {totalMonitoramento > 99 ? "99+" : totalMonitoramento}
              </span>
            )}
          </NavLink>
        ))}

      </nav>

      {/* Settings & Collapse */}
      <div className="p-2 lg:p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="nav-item w-full justify-center hidden lg:flex"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-card shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar flex flex-col z-50 transition-transform duration-300 lg:hidden w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar flex-col transition-all duration-300 z-40 hidden lg:flex",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
