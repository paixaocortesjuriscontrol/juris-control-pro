import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Radar } from "lucide-react";
import { MultiUserSelect } from "@/components/shared/MultiUserSelect";
import {
  destinatariosMarcadosInicialmente,
  montarConfigAcompanhamento,
} from "@/lib/destinatariosAcompanhamento";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacaoId: string;
  coordenacaoNome?: string;
}

export function ConfigAcompanhamentoEspecialDialog({
  open,
  onOpenChange,
  coordenacaoId,
  coordenacaoNome,
}: Props) {
  const queryClient = useQueryClient();
  const [dias, setDias] = useState(7);
  const [notificarRetro, setNotificarRetro] = useState(false);
  const [destinatarios, setDestinatarios] = useState<string[]>([]);
  const [usarEmailUnico, setUsarEmailUnico] = useState(false);
  const [emailUnico, setEmailUnico] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["config-acompanhamento-especial", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_acompanhamento_especial")
        .select("*")
        .eq("coordenacao_id", coordenacaoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: coordenadores = [] } = useQuery({
    queryKey: ["coordenadores-acompanhamento-especial", coordenacaoId],
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("coordenadores_da_coordenacao", {
        _coordenacao_id: coordenacaoId,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => r.usuario_id).filter(Boolean) as string[];
    },
  });

  useEffect(() => {
    if (!open) return;
    setDias((config as any)?.dias_janela_aviso ?? 7);
    setNotificarRetro(!!(config as any)?.notificar_retroativos);
    const eu = ((config as any)?.email_unico as string) ?? "";
    setEmailUnico(eu);
    setUsarEmailUnico(!!eu);
    const salvos = ((config as any)?.destinatarios_ids as string[]) ?? [];
    const excluidos = ((config as any)?.coordenadores_excluidos_ids as string[]) ?? [];
    setDestinatarios(destinatariosMarcadosInicialmente(salvos, coordenadores, excluidos));
  }, [open, config, JSON.stringify(coordenadores)]);

  const salvar = useMutation({
    mutationFn: async () => {
      const email = usarEmailUnico ? emailUnico.trim().toLowerCase() : "";
      if (usarEmailUnico && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new Error("Digite um e-mail válido ou volte para o padrão.");
      }
      const { data, error } = await supabase
        .from("config_acompanhamento_especial")
        .upsert(
          {
            coordenacao_id: coordenacaoId,
            dias_janela_aviso: Math.max(1, Math.min(365, Number(dias) || 7)),
            notificar_retroativos: notificarRetro,
            ...montarConfigAcompanhamento(destinatarios, coordenadores),
            email_unico: email || null,
          } as any,
          { onConflict: "coordenacao_id" }
        )
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Você não tem permissão para alterar esta coordenação.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["config-acompanhamento-especial", coordenacaoId],
      });
      toast({ title: "Configuração salva" });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0 overflow-hidden">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Radar className="h-4 w-4" />
            Acompanhamento Especial{coordenacaoNome ? ` — ${coordenacaoNome}` : ""}
          </SheetTitle>
          <SheetDescription>
            Define quais movimentações encontradas pela Judit geram aviso (e-mail, WhatsApp e
            notificação). Movimentações fora da janela continuam sendo registradas e ficam
            visíveis na tela Monitoramento, marcadas como retroativas.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="dias">Avisar movimentações dos últimos (dias)</Label>
              <Input
                id="dias"
                type="number"
                min={1}
                max={365}
                value={dias}
                onChange={(e) => setDias(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">
                Padrão: 7 dias. Movimentações anteriores à ativação do Acompanhamento Especial
                nunca geram aviso.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Avisar movimentações retroativas</p>
                <p className="text-xs text-muted-foreground">
                  Se ligado, movimentações antigas também disparam e-mail e WhatsApp.
                </p>
              </div>
              <Switch checked={notificarRetro} onCheckedChange={setNotificarRetro} />
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">E-mail único para os avisos</p>
                  <p className="text-xs text-muted-foreground">
                    Desligado: os e-mails vão para as pessoas abaixo (padrão). Ligado: os e-mails
                    de movimentações vão só para o endereço informado. Sino e WhatsApp continuam iguais.
                  </p>
                </div>
                <Switch checked={usarEmailUnico} onCheckedChange={setUsarEmailUnico} />
              </div>
              {usarEmailUnico && (
                <Input
                  type="email"
                  placeholder="alertas@escritorio.com.br"
                  value={emailUnico}
                  onChange={(e) => setEmailUnico(e.target.value)}
                />
              )}
            </div>

            <MultiUserSelect
              label="Quem recebe os avisos"
              helperText="Os coordenadores já vêm marcados e podem ser desmarcados para não receber. Escolha outras pessoas para incluir nos avisos: quando alguém além dos coordenadores é escolhido, só as pessoas marcadas recebem."
              selectedIds={destinatarios}
              onChange={setDestinatarios}
              defaultIds={coordenadores}
              defaultLabel="Coordenador"
              height={200}
            />
          </div>
        )}

        <SheetFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
