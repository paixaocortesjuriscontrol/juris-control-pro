import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Gavel, Calendar, Users, Scale } from "lucide-react";

interface ProcessoDistribuicoesTabProps {
  processoId: string;
  processoNumero: string;
}

export function ProcessoDistribuicoesTab({ processoId, processoNumero }: ProcessoDistribuicoesTabProps) {
  const { data: distribuicoes = [], isLoading } = useQuery({
    queryKey: ["distribuicoes-tst", processoNumero],
    queryFn: async () => {
      // Lê de dados_benner (tabela única) filtrando pelo número do processo e por aba_origem (escopo distribuição)
      const { data, error } = await supabase
        .from("dados_benner" as any)
        .select("*")
        .eq("processo", processoNumero)
        .not("aba_origem", "is", null)
        .order("data_distribuicao", { ascending: false });

      if (error) throw error;
      // Mapeia campos: recorrente -> parte_recorrente; deriva favorabilidade textual dos booleans
      return ((data as any[]) || []).map((b: any) => ({
        ...b,
        parte_recorrente: b.recorrente ?? null,
        relator_favorabilidade: b.posicao_relator_favoravel ? "POSITIVO" : b.posicao_relator_desfavoravel ? "NEGATIVO" : null,
        turma_favorabilidade: b.posicao_turma_favoravel ? "POSITIVA" : b.posicao_turma_desfavoravel ? "NEGATIVA" : null,
      }));
    },
  });

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    try {
      return new Date(date + "T12:00:00").toLocaleDateString("pt-BR");
    } catch {
      return date;
    }
  };

  const getFavorabilidadeColor = (val: string | null) => {
    if (!val) return "secondary";
    const lower = val.toLowerCase();
    if (lower.includes("positiv")) return "default";
    if (lower.includes("negativ")) return "destructive";
    return "secondary";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gavel className="w-5 h-5" />
          Distribuições TST
          {distribuicoes.length > 0 && (
            <Badge variant="secondary" className="ml-2">{distribuicoes.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : distribuicoes.length > 0 ? (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {distribuicoes.map((dist: any) => (
                <Card key={dist.id} className="border-l-4 border-l-primary/40">
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">{formatDate(dist.data_distribuicao)}</span>
                        {dist.aba_origem && (
                          <Badge variant="outline" className="text-xs">{dist.aba_origem}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {dist.relator_favorabilidade && (
                          <Badge variant={getFavorabilidadeColor(dist.relator_favorabilidade)} className="text-xs">
                            Relator: {dist.relator_favorabilidade}
                          </Badge>
                        )}
                        {dist.turma_favorabilidade && (
                          <Badge variant={getFavorabilidadeColor(dist.turma_favorabilidade)} className="text-xs">
                            Turma: {dist.turma_favorabilidade}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      {dist.relator && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Relator</span>
                          <span className="font-medium">{dist.relator}</span>
                        </div>
                      )}
                      {dist.turma && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Turma</span>
                          <span className="font-medium">{dist.turma}</span>
                        </div>
                      )}
                      {dist.equipe && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Equipe</span>
                          <span className="font-medium">{dist.equipe}</span>
                        </div>
                      )}
                      {dist.dossie && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Dossiê</span>
                          <span className="font-medium font-mono text-xs">{dist.dossie}</span>
                        </div>
                      )}
                      {dist.parte_recorrente && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Parte Recorrente</span>
                          <span className="font-medium">{dist.parte_recorrente}</span>
                        </div>
                      )}
                      {dist.honra && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Honra</span>
                          <span className="font-medium">{dist.honra}</span>
                        </div>
                      )}
                    </div>

                    {/* Recursos */}
                    {(dist.tipo_recurso_reclamante || dist.tipo_recurso_banco) && (
                      <div className="border-t pt-3 space-y-2">
                        {dist.tipo_recurso_reclamante && (
                          <div className="text-sm">
                            <span className="text-xs text-muted-foreground">Recurso Reclamante:</span>{" "}
                            <span className="font-medium">{dist.tipo_recurso_reclamante}</span>
                            {dist.materias_recurso_reclamante && (
                              <p className="text-xs text-muted-foreground mt-0.5">{dist.materias_recurso_reclamante}</p>
                            )}
                            <div className="flex gap-2 mt-1">
                              {dist.aparelhamento_reclamante && <Badge variant="outline" className="text-xs">{dist.aparelhamento_reclamante}</Badge>}
                              {dist.chance_exito_reclamante && <Badge variant="outline" className="text-xs">Êxito: {dist.chance_exito_reclamante}</Badge>}
                            </div>
                          </div>
                        )}
                        {dist.tipo_recurso_banco && (
                          <div className="text-sm">
                            <span className="text-xs text-muted-foreground">Recurso Banco:</span>{" "}
                            <span className="font-medium">{dist.tipo_recurso_banco}</span>
                            {dist.materias_recurso_banco && (
                              <p className="text-xs text-muted-foreground mt-0.5">{dist.materias_recurso_banco}</p>
                            )}
                            <div className="flex gap-2 mt-1">
                              {dist.aparelhamento_banco && <Badge variant="outline" className="text-xs">{dist.aparelhamento_banco}</Badge>}
                              {dist.chance_exito_banco && <Badge variant="outline" className="text-xs">Êxito: {dist.chance_exito_banco}</Badge>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Extra info */}
                    {(dist.tema || dist.decisao_quarteirizado || dist.execucao) && (
                      <div className="border-t pt-2 flex flex-wrap gap-2">
                        {dist.tema && <Badge variant="secondary" className="text-xs">Tema: {dist.tema}</Badge>}
                        {dist.decisao_quarteirizado && <Badge variant="secondary" className="text-xs">Decisão: {dist.decisao_quarteirizado}</Badge>}
                        {dist.execucao && dist.execucao.toLowerCase() !== "não" && <Badge variant="secondary" className="text-xs">Execução: {dist.execucao}</Badge>}
                        {dist.midia_negativa && dist.midia_negativa.toLowerCase() !== "não" && <Badge variant="destructive" className="text-xs">Mídia Negativa</Badge>}
                        {dist.recurso_terceiros && dist.recurso_terceiros.toLowerCase() !== "não" && <Badge variant="secondary" className="text-xs">Recurso Terceiros</Badge>}
                        {dist.benner_atualizado && <Badge variant="default" className="text-xs">Benner ✓</Badge>}
                        {dist.transito_julgado && <Badge variant="default" className="text-xs">Trânsito em Julgado</Badge>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8">
            <Gavel className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma distribuição TST registrada</p>
            <p className="text-xs text-muted-foreground mt-1">Importe dados pela aba "Dr. Renata" em Importar Dados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
