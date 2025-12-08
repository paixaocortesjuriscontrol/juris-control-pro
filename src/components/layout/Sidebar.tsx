import { useState } from "react";
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
  Briefcase,
  Gavel,
  Building2,
  ShieldCheck,
  ExternalLink,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Scale, label: "Processos", path: "/processos" },
  { icon: Search, label: "Buscar Processos", path: "/buscar" },
  { icon: ExternalLink, label: "Consulta Externa", path: "/consulta-externa" },
  { icon: Upload, label: "Importar Processos", path: "/importar" },
  { icon: Users, label: "Coordenações", path: "/coordenacoes" },
  { icon: FileText, label: "Documentos", path: "/documentos" },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
];

const areas = [
  { icon: Briefcase, label: "Cível", color: "bg-area-civil" },
  { icon: Gavel, label: "Trabalhista", color: "bg-area-trabalhista" },
  { icon: Building2, label: "Empresarial", color: "bg-area-empresarial" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { isAdmin } = useUserRole();

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar flex flex-col transition-all duration-300 z-50",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold to-gold-light flex items-center justify-center shadow-gold">
            <Scale className="w-5 h-5 text-navy-deep" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="font-serif text-lg font-bold text-sidebar-foreground">Juris Control</h1>
              <p className="text-xs text-sidebar-foreground/60">Paixão Cortes Advogados</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
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

        {/* Áreas Section */}
        {!collapsed && (
          <div className="pt-6">
            <h3 className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-3">
              Áreas
            </h3>
            {areas.map((area) => (
              <button
                key={area.label}
                className="nav-item w-full justify-start"
              >
                <div className={cn("w-2 h-2 rounded-full", area.color)} />
                <span className="text-sm font-medium">{area.label}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Settings & Collapse */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn("nav-item", isActive && "nav-item-active")
            }
          >
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Administração</span>}
          </NavLink>
        )}
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            cn("nav-item", isActive && "nav-item-active")
          }
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Configurações</span>}
        </NavLink>
        
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="nav-item w-full justify-center"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
    </aside>
  );
}
