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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";

// Itens visíveis para todos os usuários autenticados
const menuItemsPublicos = [
  // Itens destacados (amarelo) - mais utilizados
  { icon: LayoutPanelTop, label: "Painel de Controle", path: "/painel-controle", highlight: true },
  { icon: Newspaper, label: "Análise DJEN", path: "/analise-djen", highlight: true },
  { icon: BookOpen, label: "Termos DJEN", path: "/termos-djen", highlight: true },
  { icon: Scale, label: "Processos Internos", path: "/processos", highlight: true },
  { icon: Clock, label: "TST Prazos", path: "/tst-prazos", highlight: true },
  { icon: Users, label: "Coordenações", path: "/coordenacoes", highlight: true },
  // Demais itens
  { icon: Bell, label: "Notificações", path: "/notificacoes", color: "text-red-400" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Calendar, label: "Agenda", path: "/minha-agenda" },
  { icon: Calendar, label: "Painel Audiências", path: "/painel-audiencias" },
  { icon: FileWarning, label: "Painel Intimações", path: "/painel-intimacoes" },
  { icon: ClipboardList, label: "Painel da Equipe", path: "/painel-equipe" },
  { icon: Newspaper, label: "Buscar DJEN", path: "/buscar-djen" },
  { icon: FolderOpen, label: "Pastas", path: "/pastas" },
  { icon: UserCircle, label: "Clientes", path: "/clientes" },
  { icon: Search, label: "Buscar Processos", path: "/buscar" },
  { icon: ExternalLink, label: "Consulta Externa", path: "/consulta-externa" },
  { icon: Newspaper, label: "Buscar PJE", path: "/buscar-pje" },
  { icon: FileText, label: "Documentos", path: "/documentos" },
  { icon: Library, label: "Repositório IA", path: "/repositorio" },
  { icon: Brain, label: "Assistente IA", path: "/assistente-juridico" },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
];

// Itens visíveis apenas para administradores (na seção inferior)
const menuItemsAdmin = [
  { icon: ShieldCheck, label: "Administração", path: "/admin" },
  { icon: Radar, label: "Monitoração", path: "/monitoracao" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAdmin } = useUserRole();

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
              <p className="text-[10px] text-sidebar-foreground/40 mt-0.5">v{APP_VERSION}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 lg:py-6 px-2 lg:px-3 space-y-1 overflow-y-auto">
        {/* Itens públicos */}
        {menuItemsPublicos.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "nav-item",
                isActive && "nav-item-active",
                item.highlight && "text-amber-400",
                item.color
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}

        {/* Itens apenas admin */}
        {isAdmin && menuItemsAdmin.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "nav-item",
                isActive && "nav-item-active"
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}

        {/* Menu Importar Dados */}
        <NavLink
          to="/importar"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              "nav-item",
              isActive && "nav-item-active"
            )
          }
        >
          <Upload className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Importar Dados</span>}
        </NavLink>
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
