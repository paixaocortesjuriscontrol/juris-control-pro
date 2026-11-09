import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/** Liga/desliga a visão de todos os itens da coordenação no Escritório do Painel. */
export function VisaoEscritorioCard({ coordenacaoId }: { coordenacaoId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [salvando, setSalvando] = useState(false);
  const key = ["coord-visao-escritorio", coordenacaoId];
  const { data: ligado, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("coordenacoes").select("escritorio_visao_completa").eq("id", coordenacaoId).maybeSingle();
      if (error) throw error;
      return data?.escritorio_visao_completa !== false;
    },
  });

  const alterar = async (valor: boolean) => {
    setSalvando(true);
    try {
      const { data, error } = await (supabase as any)
        .from("coordenacoes").update({ escritorio_visao_completa: valor }).eq("id", coordenacaoId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Você não tem permissão para alterar esta coordenação.");
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({ queryKey: ["painel-controle-coord-restritas"] });
      toast({ title: valor ? "Membros passam a ver as atividades de todos" : "Membros passam a ver só as próprias atividades" });
    } catch (e: any) {
      toast({ title: "Não foi possível salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card className="h-full border-border">
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Eye className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">Visão Escritório</h3>
            <Switch checked={!!ligado} disabled={isLoading || salvando} onCheckedChange={alterar} aria-label="Membros veem as atividades de todos no Escritório" />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {ligado
              ? "Ligado: todos os membros veem as atividades de toda a coordenação no Escritório."
              : "Desligado: advogados, assistentes e estagiários veem só as atividades em que são responsáveis ou envolvidos. Coordenadores veem tudo."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
