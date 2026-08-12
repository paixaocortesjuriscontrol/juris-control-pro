import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Check, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useEscopoAcompanhamentoEspecial } from "@/hooks/useEscopoAcompanhamentoEspecial";

type Divergencia = {
  id: string;
  processo_id: string;
  processo_numero: string | null;
  campo: string;
  valor_atual: string | null;
  valor_judit: string | null;
  detectado_em: string;
};

const LABEL_CAMPO: Record<string, string> = {
  tribunal: "Tribunal",
  orgao_julgador: "Órgão julgador",
  classe: "Classe",
  natureza: "Natureza",
  assunto: "Assunto",
  materia: "Matéria",
  comarca: "Comarca",
  vara: "Vara/Câmara",
  uf: "UF",
  instancia: "Instância",
  justica: "Justiça",
  esfera: "Esfera",
  area: "Área",
  sistema: "Sistema",
  data_distribuicao: "Data de distribuição",
  data_citacao: "Data de citação",
  data_recebimento: "Data de recebimento",
  valor_causa: "Valor da causa",
  polo_ativo: "Polo ativo",
  polo_passivo: "Polo passivo",
  reclamante: "Reclamante",
  reclamados: "Reclamado(s)",
  terceiro_envolvido: "Terceiro envolvido",
  pedidos: "Pedidos",
  fase: "Fase",
  segredo_justica: "Segredo de justiça",
};

export function AcompanhamentoEspecialDivergencias() {
  const qc = useQueryClient();
  const [resolvendo, setResolvendo] = useState<string | null>(null);
  const [resolvendoTodas, setResolvendoTodas] = useState(false);
  const { processoIds, semRestricao, isLoading: escopoLoading } = useEscopoAcompanhamentoEspecial();

  const { data: divergencias, isLoading, refetch } = useQuery({
    queryKey: ["acomp-especial-divergencias", semRestricao ? "all" : processoIds.join(",")],
    enabled: !escopoLoading,
    queryFn: async () => {
      if (!semRestricao && processoIds.length === 0) return [] as Divergencia[];
      let q = supabase
        .from("acompanhamento_especial_divergencias")
        .select("id, processo_id, processo_numero, campo, valor_atual, valor_judit, detectado_em")
        .is("resolvido_em", null)
        .order("detectado_em", { ascending: false })
        .limit(300);
      if (!semRestricao) q = q.in("processo_id", processoIds);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Divergencia[];
    },
  });

  const marcarCiente = async (id: string) => {
    setResolvendo(id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("acompanhamento_especial_divergencias")
        .update({ resolvido_em: new Date().toISOString(), resolvido_por: userData.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["acomp-especial-divergencias"] });
      toast.success("Divergência marcada como ciente.");
    } catch (e: any) {
      toast.error("Falha ao marcar", { description: e?.message ?? String(e) });
    } finally {
      setResolvendo(null);
    }
  };

  const total = divergencias?.length ?? 0;

  return (
    <Card className={total > 0 ? "border-l-4 border-l-amber-500" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Divergências Judit × formulário
              {total > 0 && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                  {total} pendente(s)
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Campos que a Judit trouxe diferentes do que já estava preenchido pelo advogado. O valor digitado
              é sempre preservado — apenas campos vazios são completados automaticamente.
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-3 w-3" /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : total === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma divergência pendente.
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Detectado</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>No formulário</TableHead>
                  <TableHead>Judit</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(divergencias ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(d.detectado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Link to={`/processos/${d.processo_id}`} className="text-primary hover:underline">
                        {d.processo_numero || d.processo_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {LABEL_CAMPO[d.campo] ?? d.campo}
                    </TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={d.valor_atual ?? ""}>
                      {d.valor_atual || "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate text-emerald-700" title={d.valor_judit ?? ""}>
                      {d.valor_judit || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolvendo === d.id}
                        onClick={() => marcarCiente(d.id)}
                      >
                        {resolvendo === d.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <><Check className="mr-1 h-3 w-3" /> Ciente</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
