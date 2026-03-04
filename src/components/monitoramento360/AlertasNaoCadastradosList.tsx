import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileQuestion,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AlertaNaoCadastrado {
  id: string;
  termo_id: string;
  processo_numero: string;
  termo_encontrado: string;
  contexto: string | null;
  conteudo_publicacao: string | null;
  prioridade: string;
  status: string;
  coordenacao_id: string | null;
  tribunal: string | null;
  observacoes: string | null;
  created_at: string;
  termo?: {
    termo: string;
    categoria: string;
  };
  coordenacao?: {
    nome: string;
  };
}

interface Props {
  coordenacaoId?: string;
}

export default function AlertasNaoCadastradosList({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [selectedAlerta, setSelectedAlerta] = useState<AlertaNaoCadastrado | null>(null);
  const [observacoes, setObservacoes] = useState("");

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas-nao-cadastrados", statusFilter, coordenacaoId],
    queryFn: async () => {
      let query = supabase
        .from("alertas_processos_nao_cadastrados")
        .select(`
          *,
          termo:termos_monitoramento(termo, categoria),
          coordenacao:coordenacoes(nome)
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (statusFilter !== "todas") {
        query = query.eq("status", statusFilter);
      }
      if (coordenacaoId) {
        query = query.eq("coordenacao_id", coordenacaoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AlertaNaoCadastrado[];
    },
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status, obs }: { id: string; status: string; obs?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: any = { status };
      if (status === "tratado" || status === "ignorado") {
        updates.tratado_por = user?.id;
        updates.tratado_em = new Date().toISOString();
      }
      if (obs !== undefined) {
        updates.observacoes = obs;
      }
      const { error } = await supabase
        .from("alertas_processos_nao_cadastrados")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-nao-cadastrados"] });
      toast.success("Alerta atualizado!");
      setSelectedAlerta(null);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "urgente": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "alta": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "media": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const pendentes = alertas.filter(a => a.status === "pendente").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-amber-500" />
              Alertas em Processos Não Cadastrados
              {pendentes > 0 && (
                <Badge variant="destructive">{pendentes}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Termos estratégicos encontrados em publicações DJEN de processos que não estão no sistema
            </CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="tratado">Tratados</SelectItem>
              <SelectItem value="ignorado">Ignorados</SelectItem>
              <SelectItem value="todas">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : alertas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {statusFilter === "pendente"
                ? "Nenhum alerta pendente de processos não cadastrados"
                : "Nenhum alerta encontrado"}
            </p>
            <p className="text-xs mt-1">
              Ative a opção acima e execute uma varredura para buscar termos em publicações de processos não importados
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedAlerta(alerta);
                    setObservacoes(alerta.observacoes || "");
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">
                          {alerta.processo_numero}
                        </span>
                        <Badge variant="outline" className={getPrioridadeColor(alerta.prioridade)}>
                          {alerta.prioridade}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {alerta.termo_encontrado}
                        </Badge>
                        {alerta.coordenacao?.nome && (
                          <Badge variant="outline" className="text-xs">
                            {alerta.coordenacao.nome}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {alerta.contexto}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(alerta.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {alerta.status === "pendente" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Marcar como tratado"
                            onClick={(e) => {
                              e.stopPropagation();
                              atualizarStatus.mutate({ id: alerta.id, status: "tratado" });
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Ignorar"
                            onClick={(e) => {
                              e.stopPropagation();
                              atualizarStatus.mutate({ id: alerta.id, status: "ignorado" });
                            }}
                          >
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Dialog de detalhes */}
        <Dialog open={!!selectedAlerta} onOpenChange={(open) => !open && setSelectedAlerta(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileQuestion className="h-5 w-5 text-amber-500" />
                Alerta - Processo Não Cadastrado
              </DialogTitle>
            </DialogHeader>
            {selectedAlerta && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Nº Processo</p>
                    <p className="font-mono font-medium">{selectedAlerta.processo_numero}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Termo Encontrado</p>
                    <p className="font-medium">{selectedAlerta.termo_encontrado}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Prioridade</p>
                    <Badge variant="outline" className={getPrioridadeColor(selectedAlerta.prioridade)}>
                      {selectedAlerta.prioridade}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Coordenação</p>
                    <p>{selectedAlerta.coordenacao?.nome || "N/A"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contexto</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedAlerta.contexto}</p>
                </div>

                {selectedAlerta.conteudo_publicacao && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Trecho da Publicação</p>
                    <ScrollArea className="h-[200px]">
                      <p className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap">
                        {selectedAlerta.conteudo_publicacao}
                      </p>
                    </ScrollArea>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Observações</p>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Adicione observações..."
                    rows={3}
                  />
                </div>

                {selectedAlerta.status === "pendente" && (
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() =>
                        atualizarStatus.mutate({
                          id: selectedAlerta.id,
                          status: "ignorado",
                          obs: observacoes,
                        })
                      }
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Ignorar
                    </Button>
                    <Button
                      onClick={() =>
                        atualizarStatus.mutate({
                          id: selectedAlerta.id,
                          status: "tratado",
                          obs: observacoes,
                        })
                      }
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Marcar como Tratado
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
