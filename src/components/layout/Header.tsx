import { useEffect, useState } from "react";
import { Search, User, LogOut, Bell, Loader2, KeyRound, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useImport } from "@/contexts/ImportContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NotificacoesDropdown } from "./NotificacoesDropdown";
import { useAcompanhamentoEspecialNovidades } from "@/hooks/useAcompanhamentoEspecialNovidades";
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
  const { total: novidadesAcomp, temNovidades, marcarComoVistas } = useAcompanhamentoEspecialNovidades();
  const navigate = useNavigate();
  const [senhaDialogOpen, setSenhaDialogOpen] = useState(false);
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false);
  const [menuUsuarioOpen, setMenuUsuarioOpen] = useState(false);
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
    if (role === "assistente_juridico_geral") return "Assistente Jurídico Geral";
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

  const abrirOpcaoUsuario = (abrirDialog: (open: boolean) => void) => {
    setMenuUsuarioOpen(false);
    window.setTimeout(() => abrirDialog(true), 150);
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

        {/* Novidades do Acompanhamento Especial (escopo do usuário) */}
        {temNovidades && (
          <button
            type="button"
            title="Novidades do Acompanhamento Especial na sua coordenação"
            onClick={() => {
              marcarComoVistas();
              navigate("/monitoramento");
            }}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-amber-700 dark:text-amber-400 transition-opacity hover:opacity-80"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs font-medium">Novidades</span>
            <span className="text-[10px] font-bold leading-none rounded-full bg-amber-500 text-white px-1.5 py-0.5">
              {novidadesAcomp > 99 ? "99+" : novidadesAcomp}
            </span>
          </button>
        )}

        {/* Notifications */}
        <NotificacoesDropdown />

        {/* User Menu */}
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-2"
          aria-label="Abrir menu da conta"
          onClick={() => setMenuUsuarioOpen(true)}
        >
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

        <Sheet open={menuUsuarioOpen} onOpenChange={setMenuUsuarioOpen}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
            <SheetHeader className="border-b px-6 py-5 text-left">
              <SheetTitle>Minha conta</SheetTitle>
              <SheetDescription>Gerencie seu perfil e suas preferências.</SheetDescription>
              <div className="flex items-center gap-3 pt-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={profileAvatarUrl ?? user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{getDisplayName()}</p>
                  <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{getRoleLabel()}</p>
                </div>
              </div>
            </SheetHeader>

            <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Opções da conta">
              <Button
                variant="ghost"
                className="h-11 w-full justify-start px-3"
                onClick={() => abrirOpcaoUsuario(setPerfilDialogOpen)}
              >
                <User className="mr-3 h-4 w-4" />
                Meu Perfil
              </Button>
              <Button
                variant="ghost"
                className="h-11 w-full justify-start px-3"
                onClick={() => abrirOpcaoUsuario(setSenhaDialogOpen)}
              >
                <KeyRound className="mr-3 h-4 w-4" />
                Alterar Senha
              </Button>
              <Button
                variant="ghost"
                className="h-11 w-full justify-start px-3"
                onClick={() => abrirOpcaoUsuario(setNotifDialogOpen)}
              >
                <Bell className="mr-3 h-4 w-4" />
                Notificações
              </Button>
            </nav>

            <SheetFooter className="border-t p-4 sm:justify-start">
              <Button
                variant="ghost"
                className="h-11 w-full justify-start px-3 text-destructive hover:text-destructive"
                onClick={() => {
                  setMenuUsuarioOpen(false);
                  void handleSignOut();
                }}
              >
                <LogOut className="mr-3 h-4 w-4" />
                Sair
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

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
