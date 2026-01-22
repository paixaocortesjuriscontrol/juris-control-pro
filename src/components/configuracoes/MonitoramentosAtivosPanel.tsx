import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  RefreshCw, 
  Globe, 
  Newspaper, 
  FileSearch, 
  Radar,
  XCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { getExecutionProgress } from '@/utils/executionProgress';

interface ExecucaoAtiva {
  id: string;
  tipo: string;
  status: string;
  iniciado_em: string;
  finalizado_em: string | null;
  registros_processados: number;
  registros_encontrados: number;
  lotes_processados: number;
  total_lotes: number | null;
  detalhes: Record<string, any> | null;
}

const TIPO_CONFIG: Record<string, { nome: string; icon: React.ElementType; cor: string }> = {
  andamentos: { nome: 'Andamentos', icon: Activity, cor: 'bg-blue-500' },
  redistribuicoes: { nome: 'Redistribuições', icon: RefreshCw, cor: 'bg-purple-500' },
  distribuicoes: { nome: 'Distribuições', icon: Globe, cor: 'bg-green-500' },
  djen: { nome: 'DJEN (Termos)', icon: Newspaper, cor: 'bg-orange-500' },
  djen_processos: { nome: 'DJEN Processos', icon: FileSearch, cor: 'bg-amber-500' },
  termos: { nome: 'Monitoração 360', icon: Radar, cor: 'bg-cyan-500' },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function ExecucaoCard({ execucao, onCancel, cancelando }: { 
  execucao: ExecucaoAtiva; 
  onCancel: () => void;
  cancelando: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  const config = TIPO_CONFIG[execucao.tipo] || { 
    nome: execucao.tipo, 
    icon: Activity, 
    cor: 'bg-muted' 
  };
  const Icon = config.icon;

  // Update elapsed time every second
  useEffect(() => {
    const started = new Date(execucao.iniciado_em).getTime();
    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [execucao.iniciado_em]);

  const { current: processados, total, percentage: progress } = getExecutionProgress({
    detalhes: execucao.detalhes,
    registros_processados: execucao.registros_processados,
    total_lotes: execucao.total_lotes,
    lotes_processados: execucao.lotes_processados,
  });

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
      <div className={`p-2 rounded-lg ${config.cor} text-white`}>
        <Icon className="h-5 w-5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium truncate">{config.nome}</span>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Executando
          </Badge>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(elapsed)}
          </span>
          {processados > 0 && (
            <span>
              {processados.toLocaleString('pt-BR')}
              {total > 0 && ` / ${total.toLocaleString('pt-BR')}`} registros
            </span>
          )}
        </div>

        {progress !== null && (
          <div className="mt-2">
            <Progress value={progress} className="h-1.5" />
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
        )}
      </div>

      <Button
        variant="destructive"
        size="sm"
        onClick={onCancel}
        disabled={cancelando}
        className="shrink-0"
      >
        {cancelando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <XCircle className="h-4 w-4 mr-1" />
            Cancelar
          </>
        )}
      </Button>
    </div>
  );
}

export function MonitoramentosAtivosPanel({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [cancelando, setCancelando] = useState<Record<string, boolean>>({});

  const { data: execucoesAtivas = [], refetch } = useQuery({
    queryKey: ['execucoes-ativas-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('execucoes_agendadas')
        .select('id, tipo, status, iniciado_em, finalizado_em, registros_processados, registros_encontrados, lotes_processados, total_lotes, detalhes')
        .eq('status', 'executando')
        // Evitar execuções "fantasmas" (status executando mas já finalizadas)
        .is('finalizado_em', null)
        .order('iniciado_em', { ascending: false });
      
      if (error) throw error;
      return (data || []) as ExecucaoAtiva[];
    },
    refetchInterval: 5000,
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('execucoes-ativas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'execucoes_agendadas' },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const handleCancelar = async (execucao: ExecucaoAtiva) => {
    setCancelando(prev => ({ ...prev, [execucao.id]: true }));
    
    try {
      // 1. Update execution status
      await supabase
        .from('execucoes_agendadas')
        .update({ 
          status: 'cancelado', 
          finalizado_em: new Date().toISOString() 
        })
        .eq('id', execucao.id);

      // 2. Set cancellation flag in metadata
      await supabase
        .from('configuracoes_monitoramento')
        .update({
          metadata: {
            cancelado: true,
            status: 'cancelado',
            cancelled_at: new Date().toISOString(),
          },
        })
        .eq('tipo', execucao.tipo)
        .is('coordenacao_id', null);

      toast.success(`${TIPO_CONFIG[execucao.tipo]?.nome || execucao.tipo} cancelado`);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['monitoring-executions'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
      refetch();
    } catch (err) {
      console.error('Erro ao cancelar:', err);
      toast.error('Erro ao cancelar monitoramento');
    } finally {
      setCancelando(prev => ({ ...prev, [execucao.id]: false }));
    }
  };

  const handleCancelarTodos = async () => {
    if (execucoesAtivas.length === 0) return;
    
    const ids = execucoesAtivas.map(e => e.id);
    const tipos = Array.from(new Set(execucoesAtivas.map(e => e.tipo)));
    
    try {
      // Cancel all executions
      await supabase
        .from('execucoes_agendadas')
        .update({ 
          status: 'cancelado', 
          finalizado_em: new Date().toISOString() 
        })
        .in('id', ids);

      // Set cancellation flags for all types
      for (const tipo of tipos) {
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: {
              cancelado: true,
              status: 'cancelado',
              cancelled_at: new Date().toISOString(),
            },
          })
          .eq('tipo', tipo)
          .is('coordenacao_id', null);
      }

      toast.success(`${execucoesAtivas.length} monitoramento(s) cancelado(s)`);
      queryClient.invalidateQueries({ queryKey: ['monitoring-executions'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-configs'] });
      refetch();
    } catch (err) {
      console.error('Erro ao cancelar todos:', err);
      toast.error('Erro ao cancelar monitoramentos');
    }
  };

  if (execucoesAtivas.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitoramentos Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum monitoramento em execução</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitoramentos Ativos
            <Badge variant="secondary" className="ml-1">
              {execucoesAtivas.length}
            </Badge>
          </CardTitle>
          {execucoesAtivas.length > 1 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCancelarTodos}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancelar Todos
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {execucoesAtivas.map((execucao) => (
              <ExecucaoCard
                key={execucao.id}
                execucao={execucao}
                onCancel={() => handleCancelar(execucao)}
                cancelando={cancelando[execucao.id] || false}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
