import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { menuItemsPublicos, menuItemsAdmin, type MenuItem } from "@/config/menuItems";

interface NivelAcessoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuarioId?: string | null;
  usuarioNome?: string | null;
  /** Perfil do membro, para sinalizar itens que ele já não alcança */
  membroEhAdmin?: boolean;
  membroEhCoordenador?: boolean;
}

export function NivelAcessoDialog({
  open,
  onOpenChange,
  usuarioId,
  usuarioNome,
  membroEhAdmin = false,
  membroEhCoordenador = false,
}: NivelAcessoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});

  const grupos = useMemo(
    () => [
      { titulo: "Menu principal", itens: menuItemsPublicos },
      { titulo: "Administração", itens: menuItemsAdmin },
    ],
    []
  );

  const itemIndisponivel = (item: MenuItem) => {
    if (item.adminOnly && !membroEhAdmin) return true;
    if (item.adminOrCoordOnly && !membroEhAdmin && !membroEhCoordenador) return true;
    return false;
  };

  useEffect(() => {
    if (!open || !usuarioId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("permissoes_menu_usuario")
        .select("menu_path, permitido")
        .eq("user_id", usuarioId);
      if (cancelled) return;
      const base: Record<string, boolean> = {};
      [...menuItemsPublicos, ...menuItemsAdmin].forEach((item) => {
        base[item.path] = true;
      });
      if (!error) {
        (data ?? []).forEach((row: any) => {
          base[row.menu_path] = row.permitido;
        });
      }
      setMarcados(base);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, usuarioId]);

  const todosMarcados = Object.values(marcados).every((v) => v);

  const toggleTodos = (valor: boolean) => {
    const novo: Record<string, boolean> = {};
    Object.keys(marcados).forEach((path) => {
      novo[path] = valor;
    });
    setMarcados(novo);
  };

  const handleSalvar = async () => {
    if (!usuarioId) return;
    setSaving(true);
    try {
      // Regra: só gravamos o que difere do padrão (itens desmarcados).
      const bloqueados = Object.entries(marcados)
        .filter(([, permitido]) => !permitido)
        .map(([menu_path]) => ({ user_id: usuarioId, menu_path, permitido: false }));

      const { error: delError } = await supabase
        .from("permissoes_menu_usuario")
        .delete()
        .eq("user_id", usuarioId);
      if (delError) throw delError;

      if (bloqueados.length > 0) {
        const { error: insError } = await supabase
          .from("permissoes_menu_usuario")
          .insert(bloqueados);
        if (insError) throw insError;
      }

      await queryClient.invalidateQueries({ queryKey: ["permissoes-menu-usuario", usuarioId] });

      toast({
        title: "Nível de acesso atualizado",
        description:
          bloqueados.length === 0
            ? "Todas as opções de menu estão liberadas para este usuário."
            : `${bloqueados.length} opção(ões) de menu bloqueada(s).`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Erro ao salvar nível de acesso",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Nível de Acesso</DialogTitle>
          <DialogDescription>
            Defina quais opções de menu {usuarioNome ? <strong>{usuarioNome}</strong> : "este usuário"} pode acessar.
            Por padrão, todas ficam marcadas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor="marcar-todos" className="cursor-pointer">
            Marcar todas as opções
          </Label>
          <Switch
            id="marcar-todos"
            checked={todosMarcados}
            onCheckedChange={(v) => toggleTodos(!!v)}
            disabled={loading || saving}
          />
        </div>

        <ScrollArea className="max-h-[50vh] pr-3">
          <div className="space-y-5">
            {grupos.map((grupo) => (
              <div key={grupo.titulo} className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{grupo.titulo}</p>
                {grupo.itens.map((item) => {
                  const indisponivel = itemIndisponivel(item);
                  return (
                    <div
                      key={item.path}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40"
                    >
                      <Checkbox
                        id={`menu-${item.path}`}
                        checked={!!marcados[item.path]}
                        disabled={loading || saving || indisponivel}
                        onCheckedChange={(v) =>
                          setMarcados((prev) => ({ ...prev, [item.path]: !!v }))
                        }
                      />
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <Label
                        htmlFor={`menu-${item.path}`}
                        className={`flex-1 cursor-pointer text-sm ${indisponivel ? "text-muted-foreground" : ""}`}
                      >
                        {item.label}
                      </Label>
                      {indisponivel && (
                        <Badge variant="outline" className="text-[10px]">
                          Restrito ao perfil
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={loading || saving || !usuarioId}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}