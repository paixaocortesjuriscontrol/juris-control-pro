/**
 * Painel de controle central para Workers VPS DJEN
 * Permite visualizar e gerenciar workers distribuídos
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Server, 
  Copy, 
  Trash2, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  Clock,
  FileText,
  ExternalLink,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Coordenacao {
  id: string;
  nome: string;
  monitoramentosCount: number;
}

interface WorkerVps {
  id: string;
  coordenacao_id: string;
  nome_worker: string;
  ip_address: string | null;
  status: string;
  ultimo_heartbeat: string | null;
  progresso: Record<string, any> | null;
  publicacoes_encontradas: number;
  publicacoes_novas: number;
  ultimo_erro: string | null;
  created_at: string;
}

export default function WorkersDjenVpsPanel() {
  const [coordenacoes, setCoordenacoes] = useState<Coordenacao[]>([]);
  const [workers, setWorkers] = useState<WorkerVps[]>([]);
  const [loading, setLoading] = useState(true);

  // Buscar coordenações com contagem de monitoramentos
  const fetchCoordenacoes = useCallback(async () => {
    const { data: coords } = await supabase
      .from('coordenacoes')
      .select('id, nome');
    
    if (!coords) return;
    
    // Contar monitoramentos por coordenação
    const { data: monitoramentos } = await supabase
      .from('monitoramentos_djen')
      .select('coordenacao_id')
      .eq('ativo', true);
    
    const counts = new Map<string, number>();
    monitoramentos?.forEach(m => {
      const count = counts.get(m.coordenacao_id) || 0;
      counts.set(m.coordenacao_id, count + 1);
    });
    
    setCoordenacoes(
      coords
        .filter(c => counts.has(c.id))
        .map(c => ({
          id: c.id,
          nome: c.nome,
          monitoramentosCount: counts.get(c.id) || 0,
        }))
        .sort((a, b) => b.monitoramentosCount - a.monitoramentosCount)
    );
  }, []);

  // Buscar workers ativos
  const fetchWorkers = useCallback(async () => {
    const { data } = await supabase
      .from('workers_djen_vps')
      .select('*')
      .order('created_at', { ascending: false });
    
    setWorkers((data || []) as WorkerVps[]);
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchCoordenacoes(), fetchWorkers()]);
      setLoading(false);
    };
    loadData();

    // Atualizar a cada 10 segundos
    const interval = setInterval(fetchWorkers, 10000);
    return () => clearInterval(interval);
  }, [fetchCoordenacoes, fetchWorkers]);

  // Copiar URL do worker
  const copiarUrl = (coordenacaoId: string) => {
    const url = `${window.location.origin}/worker-djen-vps?coordenacao=${coordenacaoId}&autostart=true`;
    navigator.clipboard.writeText(url);
    toast.success('URL copiada para a área de transferência');
  };

  // Abrir worker em nova aba
  const abrirWorker = (coordenacaoId: string) => {
    const url = `/worker-djen-vps?coordenacao=${coordenacaoId}`;
    window.open(url, '_blank');
  };

  // Remover worker offline
  const removerWorker = async (workerId: string) => {
    await supabase
      .from('workers_djen_vps')
      .delete()
      .eq('id', workerId);
    
    await fetchWorkers();
    toast.success('Worker removido');
  };

  // Limpar workers offline
  const limparOffline = async () => {
    const { error } = await supabase
      .from('workers_djen_vps')
      .delete()
      .eq('status', 'offline');
    
    if (!error) {
      await fetchWorkers();
      toast.success('Workers offline removidos');
    }
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'executando':
        return <Badge className="bg-blue-500">Executando</Badge>;
      case 'online':
        return <Badge className="bg-green-500">Online</Badge>;
      case 'concluido':
        return <Badge className="bg-emerald-500">Concluído</Badge>;
      case 'erro':
        return <Badge variant="destructive">Erro</Badge>;
      case 'pausado':
        return <Badge className="bg-yellow-500">Pausado</Badge>;
      default:
        return <Badge variant="secondary">Offline</Badge>;
    }
  };

  // Verificar se worker está stale (sem heartbeat há mais de 2 min)
  const isWorkerStale = (worker: WorkerVps) => {
    if (!worker.ultimo_heartbeat) return true;
    const diff = Date.now() - new Date(worker.ultimo_heartbeat).getTime();
    return diff > 2 * 60 * 1000;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" />
            Workers VPS Distribuídos
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie workers de busca DJEN em múltiplas VPS
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchWorkers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          {workers.some(w => w.status === 'offline') && (
            <Button variant="outline" size="sm" onClick={limparOffline}>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Offline
            </Button>
          )}
        </div>
      </div>

      {/* Coordenações disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coordenações Disponíveis</CardTitle>
          <CardDescription>
            Copie a URL para executar em uma VPS externa ou abra localmente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coordenacoes.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma coordenação com monitoramentos ativos
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {coordenacoes.map(coord => {
                  const activeWorker = workers.find(
                    w => w.coordenacao_id === coord.id && 
                    (w.status === 'executando' || w.status === 'online')
                  );
                  
                  return (
                    <div 
                      key={coord.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium">{coord.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {coord.monitoramentosCount} monitoramentos
                          </div>
                        </div>
                        {activeWorker && (
                          <Badge variant="outline" className="gap-1">
                            <Wifi className="h-3 w-3 text-green-500" />
                            {activeWorker.ip_address || 'Ativo'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copiarUrl(coord.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => abrirWorker(coord.id)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Workers ativos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workers Registrados</CardTitle>
          <CardDescription>
            Monitoramento em tempo real dos workers ativos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum worker registrado ainda</p>
              <p className="text-sm">Abra uma URL de worker para iniciar</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {workers.map(worker => {
                  const coord = coordenacoes.find(c => c.id === worker.coordenacao_id);
                  const progresso = worker.progresso as Record<string, any> | null;
                  const stale = isWorkerStale(worker) && worker.status !== 'offline';
                  const percentage = progresso?.totalMonitoramentos
                    ? Math.round((progresso.monitoramentoAtual / progresso.totalMonitoramentos) * 100)
                    : 0;
                  
                  return (
                    <div 
                      key={worker.id}
                      className={`p-4 border rounded-lg space-y-3 ${
                        stale ? 'border-yellow-500/50 bg-yellow-500/5' : ''
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {coord?.nome || 'Coordenação desconhecida'}
                            </span>
                            {getStatusBadge(worker.status)}
                            {stale && worker.status !== 'offline' && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Sem resposta
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {worker.ip_address ? (
                              <span className="flex items-center gap-1">
                                <Wifi className="h-3 w-3" />
                                {worker.ip_address}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <WifiOff className="h-3 w-3" />
                                IP não detectado
                              </span>
                            )}
                            {worker.ultimo_heartbeat && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(worker.ultimo_heartbeat), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removerWorker(worker.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Progress */}
                      {worker.status === 'executando' && progresso && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>
                              {progresso.monitoramentoAtual || 0} de {progresso.totalMonitoramentos || 0}
                            </span>
                            <span>{percentage}%</span>
                          </div>
                          <Progress value={percentage} className="h-1.5" />
                          {progresso.mensagem && (
                            <p className="text-xs text-muted-foreground truncate">
                              {progresso.mensagem}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4 text-green-500" />
                          <span className="font-medium">{worker.publicacoes_novas || 0}</span>
                          <span className="text-muted-foreground">novas</span>
                        </div>
                        {worker.status === 'concluido' && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Concluído</span>
                          </div>
                        )}
                        {worker.ultimo_erro && (
                          <div className="flex items-center gap-1 text-red-500">
                            <AlertCircle className="h-4 w-4" />
                            <span className="truncate max-w-[200px]">{worker.ultimo_erro}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como usar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <Badge variant="outline">1</Badge>
            <span>Copie a URL de uma coordenação clicando no ícone de copiar</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">2</Badge>
            <span>Acesse a URL em uma VPS (ex: Hostinger) com o navegador logado</span>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">3</Badge>
            <span>A busca iniciará automaticamente usando o IP da VPS</span>
          </div>
          <Separator className="my-2" />
          <p className="text-xs">
            <strong>Dica:</strong> Use múltiplas VPS para processar diferentes coordenações em paralelo,
            distribuindo a carga e evitando rate limits.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
