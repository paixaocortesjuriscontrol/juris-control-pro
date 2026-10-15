import { NavLink } from "react-router-dom";
import { LayoutPanelTop, Scale, Newspaper, Gavel, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";

const ATALHOS = [
  { path: "/painel-controle", label: "Painel", icon: LayoutPanelTop },
  { path: "/processos", label: "Processos", icon: Scale },
  { path: "/analise-djen", label: "DJEN", icon: Newspaper },
  { path: "/pautas-julgamento", label: "Pautas", icon: Gavel },
];

export function MobileBottomNav() {
  const { isMenuAllowed } = useMenuPermissions();
  const itens = ATALHOS.filter((a) => isMenuAllowed(a.path));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 w-full max-w-[100vw] z-40 border-t border-sidebar-border bg-sidebar text-sidebar-foreground"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Atalhos"
    >
      <div className="flex">
        {itens.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px]",
                isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"
              )
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("abrir-menu-mobile"))}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] text-sidebar-foreground/70"
        >
          <Menu className="w-5 h-5" />
          Menu
        </button>
      </div>
    </nav>
  );
}
