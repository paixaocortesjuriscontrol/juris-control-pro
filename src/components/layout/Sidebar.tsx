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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarCollapsed } from "@/contexts/SidebarContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";

type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  highlight?: boolean;
  color?: string;
  adminOnly?: boolean;
};

// Itens visíveis para todos os usuários autenticados
const menuItemsPublicos: MenuItem[] = [
  // Itens destacados (amarelo) - mais utilizados
  { icon: LayoutPanelTop, label: "Painel de Controle", path: "/painel-controle", highlight: true },
  { icon: Newspaper, label: "Análise DJEN", path: "/analise-djen", highlight: true },
  { icon: ArrowRightLeft, label: "Comparar DJEN", path: "/comparar-dj-santander", highlight: true },
  { icon: BookOpen, label: "Termos DJEN", path: "/termos-djen", highlight: true },
  { icon: Scale, label: "Processos e Casos", path: "/processos", highlight: true },
  { icon: Users, label: "Coordenações", path: "/coordenacoes", highlight: true },
  { icon: Sparkles, label: "IA Responde", path: "/ia-responde", color: "text-amber-400", adminOnly: true },
  // Demais itens
  { icon: Scale, label: "Distribuição TST", path: "/distribuicao-tst", color: "text-sky-400" },
  { icon: BookOpen, label: "Matérias Benner", path: "/materias-benner", color: "text-sky-400" },
  { icon: ShieldCheck, label: "Admin. TST", path: "/admin-tst", color: "text-sky-400" },
  { icon: Library, label: "Repositório IA", path: "/repositorio", color: "text-sky-400" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Calendar, label: "Agenda", path: "/minha-agenda" },
  { icon: FolderOpen, label: "Pastas", path: "/pastas" },
  { icon: UserCircle, label: "Clientes", path: "/clientes" },
  { icon: FileText, label: "Documentos", path: "/documentos" },
  { icon: Brain, label: "Assistente IA", path: "/assistente-juridico" },
];

// Itens visíveis apenas para administradores (na seção inferior)
const menuItemsAdmin: MenuItem[] = [
  { icon: ShieldCheck, label: "Administração", path: "/admin" },
];

const menuItems = [...menuItemsPublicos, ...menuItemsAdmin];

export function Sidebar() {
  const { collapsed, setCollapsed } = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAdmin, isAdminOrCoordinator, role } = useUserRole();
  const isAdvogadoTemporario = role === "advogado_temporario";

  // Advogado Temporário (perfil de conferência) vê Análise DJEN, Termos DJEN e Comparar DJEN
  const allowedForTemporario = new Set(["/analise-djen", "/termos-djen", "/comparar-dj-santander", "/errata-djen"]);

  const visiblePublicos = isAdvogadoTemporario
    ? menuItemsPublicos.filter((item) => allowedForTemporario.has(item.path))
    : menuItemsPublicos.filter(
        (item) =>
          (!item.adminOnly || isAdmin) &&
          (item.highlight || item.color || isAdminOrCoordinator)
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
              <p className="text-[10px] text-sidebar-foreground/40 mt-0.5">v{APP_VERSION}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 lg:py-6 px-2 lg:px-3 space-y-1 overflow-y-auto">
        {[
          ...visiblePublicos,
          ...(isAdminOrCoordinator && !isAdvogadoTemporario ? menuItemsAdmin : []),
        ].map((item) => (
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
