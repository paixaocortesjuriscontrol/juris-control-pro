import { Search, User, LogOut, Bell, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useImport } from "@/contexts/ImportContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { NotificacoesDropdown } from "./NotificacoesDropdown";
import { Badge } from "@/components/ui/badge";

import { ReactNode } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
}

export function Header({ title, subtitle, headerActions }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { isImporting, importLabel } = useImport();
  const { role } = useUserRole();
  const navigate = useNavigate();

  const getRoleLabel = () => {
    if (role === "admin") return "Administrador";
    if (role === "coordenador") return "Coordenador";
    return "Usuário";
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sair");
    } finally {
      navigate("/auth", { replace: true });
    }
  };

  const getInitials = () => {
    if (user?.user_metadata?.nome) {
      const names = user.user_metadata.nome.split(" ");
      return names.length > 1 
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0].substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "U";
  };

  const getDisplayName = () => {
    return user?.user_metadata?.nome || user?.email?.split("@")[0] || "Usuário";
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 print:hidden">
      <div className="pl-12 lg:pl-0">
        <h1 className="font-serif text-lg lg:text-xl font-semibold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        {/* Header Actions (filters, etc) */}
        {headerActions}
        {/* Import Indicator */}
        {isImporting && (
          <Badge variant="secondary" className="flex items-center gap-1.5 bg-amber-500/20 text-amber-600 border-amber-500/30 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="hidden sm:inline text-xs font-medium">
              {importLabel || "Importando..."}
            </span>
          </Badge>
        )}

        {/* Search - Hidden on mobile */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar processo, cliente..." 
            className="w-64 pl-9 bg-secondary/50 border-border/50"
          />
        </div>

        {/* Mobile Search Button */}
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Search className="w-5 h-5 text-muted-foreground" />
        </Button>

        {/* Notifications */}
        <NotificacoesDropdown />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium leading-tight">{getDisplayName()}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{getRoleLabel()}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{getDisplayName()}</span>
                <span className="text-xs font-normal text-muted-foreground truncate">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Bell className="w-4 h-4 mr-2" />
              Notificações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onSelect={(e) => {
                e.preventDefault();
                handleSignOut();
              }} 
              className="text-destructive cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
