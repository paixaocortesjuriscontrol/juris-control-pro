import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useEscopoAcompanhamentoEspecial } from "@/hooks/useEscopoAcompanhamentoEspecial";
import { AcompanhamentoEspecialDivergencias } from "@/components/djen/AcompanhamentoEspecialDivergencias";

/**
 * Status da rotina de Acompanhamento Especial visível para
 * Administrador, Coordenador e Responsáveis pelos processos.
 */
export function AcompanhamentoEspecialResumo() {
  const qc = useQueryClient();
  const [executando, setExecutando] = useState(false);
  const { semRestricao, podeExecutar, isLoading: escopoLoading } = useEscopoAcompanhamentoEspecial();
  const podeVer = semRestricao || podeExecutar;

  const { data: ultima, isLoading } = useQuery({
    queryKey: ["acomp-especial-ultima-execucao"],
    enabled: podeVer,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execucoes_acompanhamento_especial")
        .select("id, slot, disparo, status, iniciado_em, total_processos, total_novos_eventos, total_erros, erro")
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const executarAgora = async () => {
    setExecutando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.functions.invoke("judit-acompanhamento-especial", {
        body: { slot: 10, manual: true, invocado_por: userData.user?.id ?? null },
      });
      if (error) throw error;
      toast.success("Rotina executada", { description: "Consulta à Judit concluída." });
      await qc.invalidateQueries({ queryKey: ["acomp-especial-ultima-execucao"] });
      await qc.invalidateQueries({ queryKey: ["acomp-especial-divergencias"] });
    } catch (e: any) {
      toast.error("Falha ao executar", { description: e?.message ?? String(e) });
    } finally {
      setExecutando(false);
    }
  };

  if (escopoLoading || !podeVer) return null;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-card p-2.5 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-semibold flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-blue-600" /> Rotina Judit
        </span>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : !ultima ? (
          <span className="text-muted-foreground">Nenhuma execução registrada ainda.</span>
        ) : (
          <>
            <span className="text-muted-foreground">
              Última: {format(new Date(ultima.iniciado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              {ultima.slot != null ? ` · slot ${ultima.slot}h` : ""} · {ultima.disparo}
            </span>
            <Badge
              variant="outline"
              className={
                ultima.status === "erro"
                  ? "bg-destructive/10 text-destructive border-destructive/30 gap-1"
                  : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1"
              }
            >
              {ultima.status === "erro" ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              {ultima.status}
            </Badge>
            <span className="text-muted-foreground">
              {ultima.total_processos} processo(s) · {ultima.total_novos_eventos} novo(s) · {ultima.total_erros} erro(s)
            </span>
          </>
        )}
        <Button size="sm" variant="outline" className="h-7 ml-auto" disabled={executando} onClick={executarAgora}>
          {executando ? (
            <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Executando…</>
          ) : (
            <><PlayCircle className="mr-1.5 h-3 w-3" /> Executar agora</>
          )}
        </Button>
      </div>
      <AcompanhamentoEspecialDivergencias />
    </div>
  );
}
