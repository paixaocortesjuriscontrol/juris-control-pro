import { useEffect, useState } from "react";
import { Search, User, LogOut, Bell, Loader2, KeyRound } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NotificacoesDropdown } from "./NotificacoesDropdown";
import { AlterarSenhaDialog } from "./AlterarSenhaDialog";
import { MeuPerfilDialog } from "./MeuPerfilDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfigNotificacoesUsuarioCard } from "@/components/configuracoes/ConfigNotificacoesUsuarioCard";
import { Badge } from "@/components/ui/badge";
import { BuscaGlobalPainel } from "@/components/painel/BuscaGlobalPainel";

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
  const [senhaDialogOpen, setSenhaDialogOpen] = useState(false);
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false);
  const [profileNome, setProfileNome] = useState<string | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setProfileNome(null);
      return;
    }
    supabase
      .from("profiles")
      .select("nome, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setProfileNome(data?.nome ?? null);
          setProfileAvatarUrl((data as any)?.avatar_url ?? null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const getRoleLabel = () => {
    if (role === "admin") return "Administrador";
    if (role === "coordenador") return "Coordenador";
    if (role === "assistente_coordenador") return "Assistente Coordenador";
    if (role === "advogado") return "Advogado(a)";
    if (role === "advogado_temporario") return "Advogado DJEN Conferência";
    if (role === "estagiario") return "Estagiário(a)";
    if (role === "assistente") return "Assistente";
    if (role === "secretaria") return "Secretária";
    if (role === "cliente") return "Cliente";
    return "Sem perfil";
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
    const nome = profileNome || user?.user_metadata?.nome;
    if (nome) {
      const names = nome.split(" ");
      return names.length > 1 
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0].substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "U";
  };

  const getDisplayName = () => {
    return profileNome || user?.user_metadata?.nome || user?.email?.split("@")[0] || "Usuário";
  };

  return (
    <header className="min-h-16 py-2 bg-card border-b border-border flex flex-wrap items-center justify-between gap-y-2 px-4 lg:px-6 print:hidden">
      <div className="pl-12 lg:pl-0 min-w-0">
        <h1 className="font-serif text-lg lg:text-xl font-semibold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">{subtitle}</p>
        )}
      </div>

      {/* Busca global fixa em todas as telas */}
      <div className="hidden md:block flex-1 min-w-[220px] max-w-xl mx-4">
        <BuscaGlobalPainel />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 lg:gap-3 min-w-0">
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

        {/* Notifications */}
        <NotificacoesDropdown />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={profileAvatarUrl ?? user?.user_metadata?.avatar_url} />
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
            <DropdownMenuItem onSelect={() => setPerfilDialogOpen(true)}>
              <User className="w-4 h-4 mr-2" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSenhaDialogOpen(true)}>
              <KeyRound className="w-4 h-4 mr-2" />
              Alterar Senha
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setNotifDialogOpen(true)}>
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

        <AlterarSenhaDialog open={senhaDialogOpen} onOpenChange={setSenhaDialogOpen} />
        <MeuPerfilDialog
          open={perfilDialogOpen}
          onOpenChange={setPerfilDialogOpen}
          onSaved={(nome, avatarUrl) => {
            if (nome !== undefined) setProfileNome(nome);
            if (avatarUrl !== undefined) setProfileAvatarUrl(avatarUrl);
          }}
        />

        <Dialog open={notifDialogOpen} onOpenChange={setNotifDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Minhas notificações</DialogTitle>
            </DialogHeader>
            <ConfigNotificacoesUsuarioCard />
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
