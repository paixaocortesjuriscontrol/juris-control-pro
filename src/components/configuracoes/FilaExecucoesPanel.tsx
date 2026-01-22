import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Activity, 
  RefreshCw, 
  Globe, 
  Newspaper, 
  FileSearch, 
  Radar,
  Clock,
  Loader2,
  Ban,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { useEffect } from 'react';

const TIPO_CONFIG: Record<string, { nome: string; icon: React.ElementType; cor: string }> = {
  andamentos: { nome: 'Andamentos', icon: Activity, cor: 'bg-blue-500' },
  redistribuicoes: { nome: 'Redistribuições', icon: RefreshCw, cor: 'bg-purple-500' },
  distribuicoes: { nome: 'Distribuições', icon: Globe, cor: 'bg-green-500' },
  djen: { nome: 'DJEN (Termos)', icon: Newspaper, cor: 'bg-orange-500' },
  djen_processos: { nome: 'DJEN Processos', icon: FileSearch, cor: 'bg-amber-500' },
  termos: { nome: 'Monitoração 360', icon: Radar, cor: 'bg-cyan-500' },
};

const TIPOS_PESADOS = ['andamentos', 'redistribuicoes', 'djen_processos', 'termos', 'djen'];

interface Execucao {
  id: string;
  tipo: string;
  status: string;
  iniciado_em: string;
  finalizado_em: string | null;
  lotes_processados: number;
  registros_processados: number;
  registros_encontrados?: number;
  total_lotes?: number | null;
  detalhes?: Record<string, any> | null;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'executando':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case 'concluido':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'cancelado':
      return <Ban className="h-4 w-4 text-muted-foreground" />;
    case 'falhou':
    case 'timeout':
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function FilaExecucoesPanel({ className }: { className?: string }) {
  const { data: execucoes = [], refetch } = useQuery({
    queryKey: ['fila-execucoes'],
    queryFn: async () => {
      // Buscar execuções das últimas 24h
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('id, tipo, status, iniciado_em, finalizado_em, lotes_processados, total_lotes, registros_processados, registros_encontrados, detalhes')
        .gte('iniciado_em', ontem)
        .order('iniciado_em', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return (data || []) as Execucao[];
    },
    refetchInterval: 5000,
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('fila-execucoes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'execucoes_agendadas' },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Separar execuções por status
  // Só considerar "executando" se não tiver finalizado_em (evita execução fantasma)
  const executando = execucoes.filter(e => e.status === 'executando' && !e.finalizado_em);
  const recentes = execucoes.filter(e => e.status !== 'executando').slice(0, 10);

  // Determinar quais tipos estão bloqueados
  const tipoExecutando = executando[0]?.tipo;
  const tiposBloqueados = tipoExecutando && TIPOS_PESADOS.includes(tipoExecutando)
    ? TIPOS_PESADOS.filter(t => t !== tipoExecutando)
    : [];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Fila de Execuções
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Execução Ativa */}
        {executando.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Em execução</div>
            {executando.map((exec) => {
              const config = TIPO_CONFIG[exec.tipo] || { nome: exec.tipo, icon: Activity, cor: 'bg-muted' };
              const Icon = config.icon;
              const elapsed = Date.now() - new Date(exec.iniciado_em).getTime();

              const p = exec.detalhes?.progress as { current?: number; total?: number; percentage?: number } | undefined;
              const current = (typeof p?.current === 'number' ? p.current : null)
                ?? (typeof exec.lotes_processados === 'number' ? exec.lotes_processados : 0);
              const total = (typeof p?.total === 'number' ? p.total : null)
                ?? (typeof exec.total_lotes === 'number' ? exec.total_lotes : 0);
              const percent = (typeof p?.percentage === 'number' ? p.percentage : null)
                ?? (total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null);
              
              return (
                <div 
                  key={exec.id}
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5"
                >
                  <div className={`p-2 rounded-lg ${config.cor} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{config.nome}</span>
                      <Badge variant="default" className="text-xs">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Executando
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDuration(elapsed)} • {current.toLocaleString('pt-BR')}
                      {total > 0 ? ` / ${total.toLocaleString('pt-BR')}` : ''} registros
                      {percent !== null ? ` • ${percent}%` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-1 opacity-50" />
            Nenhuma execução ativa
          </div>
        )}

        {/* Tipos Bloqueados */}
        {tiposBloqueados.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Ban className="h-3.5 w-3.5" />
              Aguardando (bloqueados por {TIPO_CONFIG[tipoExecutando]?.nome})
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tiposBloqueados.map((tipo) => {
                const config = TIPO_CONFIG[tipo] || { nome: tipo, icon: Activity, cor: 'bg-muted' };
                const Icon = config.icon;
                
                return (
                  <TooltipProvider key={tipo}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 opacity-60">
                          <div className={`p-1.5 rounded ${config.cor} text-white`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm truncate">{config.nome}</span>
                          <Ban className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Aguardando {TIPO_CONFIG[tipoExecutando]?.nome} finalizar</p>
                        <p className="text-xs text-muted-foreground">Execuções pesadas são sequenciais para evitar WORKER_LIMIT</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>
        )}

        {/* Diagrama Visual de Bloqueio */}
        {executando.length > 0 && tiposBloqueados.length > 0 && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="text-xs font-medium text-muted-foreground mb-2">Fluxo de Execução</div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-primary/20 text-primary text-xs font-medium">
                <Loader2 className="h-3 w-3 animate-spin" />
                {TIPO_CONFIG[tipoExecutando]?.nome}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-muted-foreground text-xs">
                <Clock className="h-3 w-3" />
                {tiposBloqueados.length} na fila
              </div>
            </div>
          </div>
        )}

        {/* Histórico Recente */}
        {recentes.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Histórico recente</div>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {recentes.map((exec) => {
                  const config = TIPO_CONFIG[exec.tipo] || { nome: exec.tipo, icon: Activity, cor: 'bg-muted' };
                  const Icon = config.icon;
                  const duracao = exec.finalizado_em 
                    ? new Date(exec.finalizado_em).getTime() - new Date(exec.iniciado_em).getTime()
                    : 0;
                  
                  return (
                    <div 
                      key={exec.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <StatusIcon status={exec.status} />
                      <div className={`p-1 rounded ${config.cor} text-white`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="text-sm truncate flex-1">{config.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {duracao > 0 ? formatDuration(duracao) : '-'}
                      </span>
                      <Badge 
                        variant={exec.status === 'concluido' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {exec.status === 'concluido' ? 'OK' : exec.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
