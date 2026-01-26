import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  RefreshCw, Activity, Globe, Newspaper, FileSearch, Radar,
  CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, PlayCircle,
  ChevronDown, ChevronUp, History, StopCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { 
  useStatusMonitoramentos, 
  useExecucoesRecentes,
  formatarDataExecucao, 
  formatarDuracao,
  type StatusMonitoramento 
} from "@/hooks/useStatusMonitoramentos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// NOTA: 'djen' foi removido - agora usa busca direta no frontend (BuscaDjenDiretaCard)
const ICONS: Record<string, React.ElementType> = {
  redistribuicoes: RefreshCw,
  andamentos: Activity,
  distribuicoes: Globe,
  djen_processos: FileSearch,
  termos: Radar,
};

const NOMES: Record<string, string> = {
  redistribuicoes: 'Redistribuições',
  andamentos: 'Andamentos',
  distribuicoes: 'Distribuições',
  djen_processos: 'DJEN Processos',
  termos: 'Monitoração 360',
};

const FUNCOES: Record<string, string> = {
  redistribuicoes: 'monitorar-redistribuicoes',
  andamentos: 'monitorar-andamentos',
  distribuicoes: 'monitorar-distribuicoes',
  djen_processos: 'monitorar-djen-processos',
  termos: 'monitorar-termos',
};

function HealthBadge({ status }: { status: StatusMonitoramento['health_status'] }) {
  const configs = {
    ok: { label: 'OK', variant: 'default' as const, icon: CheckCircle2, className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    executando: { label: 'Executando', variant: 'secondary' as const, icon: Loader2, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse' },
    erro: { label: 'Erro', variant: 'destructive' as const, icon: XCircle, className: 'bg-red-500/10 text-red-600 border-red-500/20' },
    timeout_provavel: { label: 'Timeout?', variant: 'destructive' as const, icon: AlertTriangle, className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
    atrasado: { label: 'Atrasado', variant: 'outline' as const, icon: Clock, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
    nunca_executou: { label: 'Nunca executou', variant: 'outline' as const, icon: Clock, className: 'bg-muted text-muted-foreground' },
  };
  
  const config = configs[status];
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className={cn("gap-1", config.className)}>
      <Icon className={cn("h-3 w-3", status === 'executando' && "animate-spin")} />
      {config.label}
    </Badge>
  );
}

function ProgressoDetalhado({ status }: { status: StatusMonitoramento }) {
  const exec = status.ultima_execucao;
  if (!exec) return null;
  
  const isExecutando = status.health_status === 'executando';
  
  // Priorizar detalhes.progress (fonte mais precisa vinda do orquestrador)
  const progress = exec.detalhes?.progress as { current?: number; total?: number; percentage?: number } | undefined;
  let progresso: number | null = null;
  let processados = 0;
  let total = 0;
  
  if (progress) {
    if (typeof progress.percentage === 'number') progresso = progress.percentage;
    if (typeof progress.current === 'number') processados = progress.current;
    if (typeof progress.total === 'number') total = progress.total;
  }
  
  // Fallback para lotes_processados/total_lotes se detalhes.progress não existir
  if (total === 0 && exec.total_lotes && exec.total_lotes > 0) {
    total = exec.total_lotes;
    processados = exec.lotes_processados || 0;
    progresso = Math.min(100, Math.round((processados / total) * 100));
  }
  
  // Calcular progresso se ainda não temos
  if (total > 0 && processados > 0 && progresso === null) {
    progresso = Math.min(100, Math.round((processados / total) * 100));
  }
  
  const iniciado = new Date(exec.iniciado_em);
  const agora = new Date();
  const segundosDecorridos = Math.round((agora.getTime() - iniciado.getTime()) / 1000);
  const tempoFormatado = formatarDuracao(segundosDecorridos);
  
  return (
    <div className={cn(
      "rounded-lg p-3 space-y-2 border",
      isExecutando ? "bg-blue-500/5 border-blue-500/20" : "bg-muted/30 border-border"
    )}>
      {/* Barra de progresso */}
      {progresso !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{progresso}%</span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>
      )}
      
      {/* Grid de métricas - usar processados/total de detalhes.progress */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Itens:</span>
          <span className="font-mono">{processados.toLocaleString()}{total > 0 ? `/${total.toLocaleString()}` : ''}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tempo:</span>
          <span className="font-mono">{isExecutando ? tempoFormatado : formatarDuracao(
            exec.finalizado_em 
              ? Math.round((new Date(exec.finalizado_em).getTime() - iniciado.getTime()) / 1000)
              : segundosDecorridos
          )}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Lotes:</span>
          <span className="font-mono">{exec.lotes_processados}{exec.total_lotes ? `/${exec.total_lotes}` : ''}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Encontrados:</span>
          <span className="font-mono text-green-600">{exec.registros_encontrados.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Erros */}
      {exec.erros > 0 && (
        <div className="flex items-center gap-2 text-xs text-orange-600">
          <AlertTriangle className="h-3 w-3" />
          <span>{exec.erros} erro(s) - {exec.retry_count} retries</span>
        </div>
      )}
      
      {/* Status atual */}
      {isExecutando && (
        <div className="flex items-center gap-2 text-xs text-blue-600">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Executando... {progresso !== null ? `(${progresso}% concluído)` : ''}</span>
        </div>
      )}
    </div>
  );
}

function MonitoramentoCard({ status, onExecutar, onCancelar, executando, cancelando }: { 
  status: StatusMonitoramento; 
  onExecutar: () => void;
  onCancelar: () => void;
  executando: boolean;
  cancelando: boolean;
}) {
  const [expandido, setExpandido] = useState(false);
  const Icon = ICONS[status.tipo] || Activity;
  const nome = NOMES[status.tipo] || status.tipo;
  
  return (
    <Card className={cn(
      "transition-all duration-200",
      status.health_status === 'erro' && "border-red-500/50",
      status.health_status === 'timeout_provavel' && "border-orange-500/50",
      status.health_status === 'executando' && "border-blue-500/50",
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              status.health_status === 'ok' && "bg-green-500/10",
              status.health_status === 'erro' && "bg-red-500/10",
              status.health_status === 'executando' && "bg-blue-500/10",
              status.health_status === 'atrasado' && "bg-yellow-500/10",
              status.health_status === 'timeout_provavel' && "bg-orange-500/10",
              status.health_status === 'nunca_executou' && "bg-muted",
            )}>
              <Icon className={cn(
                "h-5 w-5",
                status.health_status === 'ok' && "text-green-600",
                status.health_status === 'erro' && "text-red-600",
                status.health_status === 'executando' && "text-blue-600 animate-pulse",
                status.health_status === 'atrasado' && "text-yellow-600",
                status.health_status === 'timeout_provavel' && "text-orange-600",
                status.health_status === 'nunca_executou' && "text-muted-foreground",
              )} />
            </div>
            <div>
              <CardTitle className="text-base">{nome}</CardTitle>
              <CardDescription className="text-xs">
                {status.ativo ? 'Ativo' : 'Desativado'} • {status.frequencia}
              </CardDescription>
            </div>
          </div>
          <HealthBadge status={status.health_status} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Painel de progresso detalhado - sempre visível quando há execução recente */}
        {status.ultima_execucao && (
          <ProgressoDetalhado status={status} />
        )}
        
        {/* Estatísticas de hoje - compacto */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>Hoje: {status.execucoes_hoje} exec • {status.sucesso_hoje} ok • {status.encontrados_hoje} encontrados</span>
          <span>{formatarDataExecucao(status.ultima_execucao?.iniciado_em || status.ultima_execucao_config)}</span>
        </div>
        
        {/* Erro se houver */}
        {status.ultima_execucao?.ultimo_erro && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2">
            <div className="text-xs text-destructive font-medium">Último erro:</div>
            <div className="text-xs text-destructive/80 truncate">
              {status.ultima_execucao.ultimo_erro}
            </div>
          </div>
        )}
        
        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={onExecutar}
            disabled={executando || status.health_status === 'executando' || status.health_status === 'timeout_provavel'}
          >
            {executando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Executar
              </>
            )}
          </Button>
          
          <Button 
            size="sm" 
            variant="destructive"
            onClick={onCancelar}
            disabled={cancelando || (status.health_status !== 'executando' && status.health_status !== 'timeout_provavel')}
          >
            {cancelando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StopCircle className="h-4 w-4" />
            )}
          </Button>
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setExpandido(!expandido)}
          >
            <History className="h-4 w-4" />
            {expandido ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
          </Button>
        </div>
        
        {/* Histórico expandido */}
        {expandido && <HistoricoExecucoes tipo={status.tipo} />}
      </CardContent>
    </Card>
  );
}

function HistoricoExecucoes({ tipo }: { tipo: string }) {
  const { data: execucoes = [], isLoading } = useExecucoesRecentes(tipo, 5);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  
  if (execucoes.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        Nenhuma execução registrada
      </div>
    );
  }
  
  return (
    <div className="border-t pt-3 mt-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Últimas execuções:</div>
      {execucoes.map((exec) => (
        <div 
          key={exec.id} 
          className={cn(
            "flex items-center justify-between text-xs p-2 rounded-lg",
            exec.status === 'concluido' && "bg-green-500/5",
            exec.status === 'falhou' && "bg-red-500/5",
            exec.status === 'executando' && "bg-blue-500/5",
          )}
        >
          <div className="flex items-center gap-2">
            {exec.status === 'concluido' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
            {exec.status === 'falhou' && <XCircle className="h-3 w-3 text-red-600" />}
            {exec.status === 'executando' && <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />}
            {exec.status === 'timeout' && <AlertTriangle className="h-3 w-3 text-orange-600" />}
            <span>{formatarDataExecucao(exec.iniciado_em)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {exec.registros_encontrados} encontrados
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardMonitoramentos() {
  const { statusMonitoramentos, isLoading, refetch } = useStatusMonitoramentos();
  const [executando, setExecutando] = useState<Record<string, boolean>>({});
  const [cancelando, setCancelando] = useState<Record<string, boolean>>({});
  const [confirmReativarOpen, setConfirmReativarOpen] = useState(false);
  const [confirmTipo, setConfirmTipo] = useState<string | null>(null);
  
  // Auto-refresh quando há execuções em andamento
  const temExecucaoAtiva = statusMonitoramentos.some(s => s.health_status === 'executando');
  
  useEffect(() => {
    if (!temExecucaoAtiva) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 5000); // Atualiza a cada 5 segundos
    
    return () => clearInterval(interval);
  }, [temExecucaoAtiva, refetch]);
  
  const reativarConfig = async (tipo: string) => {
    const { data: config, error } = await supabase
      .from('configuracoes_monitoramento')
      .select('id, ativo, metadata')
      .eq('tipo', tipo)
      .is('coordenacao_id', null)
      .maybeSingle();

    if (error) throw error;
    if (!config?.id) return;

    const currentMeta = (config.metadata as Record<string, any>) || {};
    const { error: updErr } = await supabase
      .from('configuracoes_monitoramento')
      .update({
        ativo: true,
        metadata: {
          ...currentMeta,
          paused_globally: false,
          cancelado: false,
          status: 'idle',
          continuingRun: false,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id);

    if (updErr) throw updErr;
  };

  const executarAgora = async (tipo: string) => {
    setExecutando(prev => ({ ...prev, [tipo]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('executar-monitoramento', {
        body: { tipo },
      });

      if (error) throw error;

      if (data?.blocked) {
        toast.warning(data.message || 'Aguarde outra execução finalizar');
      } else if (data?.paused) {
        toast.warning('Monitoramento está pausado/desativado. Reative para executar.');
      } else if (data?.success) {
        toast.success(`${NOMES[tipo]} concluído: ${data.totalEncontrados || 0} encontrados`);
      } else if (data?.success === false && data?.error) {
        toast.error(`Erro: ${data.error}`);
      } else {
        toast.info(`${NOMES[tipo]} iniciado! Acompanhe o progresso no painel.`);
      }

      refetch();
    } catch (error: any) {
      toast.error(`Erro ao executar ${NOMES[tipo]}: ${error.message}`);
    } finally {
      setExecutando(prev => ({ ...prev, [tipo]: false }));
    }
  };

  const handleExecutar = async (tipo: string) => {
    // Se estiver desativado/pausado globalmente, pedir confirmação e reativar antes
    const { data: cfg } = await supabase
      .from('configuracoes_monitoramento')
      .select('ativo, metadata')
      .eq('tipo', tipo)
      .is('coordenacao_id', null)
      .maybeSingle();

    const md = (cfg?.metadata as Record<string, any>) || {};
    const isPaused = cfg?.ativo === false || md.paused_globally === true;
    if (isPaused) {
      setConfirmTipo(tipo);
      setConfirmReativarOpen(true);
      return;
    }

    await executarAgora(tipo);
  };

  const handleCancelar = async (tipo: string) => {
    setCancelando(prev => ({ ...prev, [tipo]: true }));
    
    try {
      // CANCELAMENTO FORÇADO DIRETO NO BANCO
      // 1. Buscar e atualizar metadata para marcar cancelado
      const { data: config } = await supabase
        .from('configuracoes_monitoramento')
        .select('id, metadata')
        .eq('tipo', tipo)
        .is('coordenacao_id', null)
        .maybeSingle();

      if (config) {
        const currentMeta = (config.metadata as Record<string, any>) || {};
        await supabase
          .from('configuracoes_monitoramento')
          .update({
            metadata: { 
              ...currentMeta, 
              cancelado: true, 
              status: 'cancelado',
              cancelled_at: new Date().toISOString()
            }
          })
          .eq('id', config.id);
      }

      // 2. Forçar cancelamento de TODAS as execuções ativas deste tipo
      const { data: canceladas, error: updateError } = await supabase
        .from('execucoes_agendadas')
        .update({
          status: 'cancelado',
          finalizado_em: new Date().toISOString(),
          detalhes: { 
            forced_cancel: true, 
            cancelado_manualmente: true, 
            cancelado_em: new Date().toISOString() 
          },
        })
        .eq('tipo', tipo)
        .eq('status', 'executando')
        .select('id');

      if (updateError) throw updateError;

      const count = canceladas?.length || 0;
      
      if (count > 0) {
        toast.success(`${count} execução(ões) de ${NOMES[tipo]} cancelada(s) imediatamente!`);
      } else {
        toast.info(`Nenhuma execução ativa de ${NOMES[tipo]} para cancelar.`);
      }
      
      refetch();
    } catch (error: any) {
      toast.error(`Erro ao cancelar: ${error.message}`);
    } finally {
      setCancelando(prev => ({ ...prev, [tipo]: false }));
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Resumo geral
  const totalOk = statusMonitoramentos.filter(s => s.health_status === 'ok').length;
  const totalExecutando = statusMonitoramentos.filter(s => s.health_status === 'executando').length;
  const totalErros = statusMonitoramentos.filter(s => s.health_status === 'erro' || s.health_status === 'timeout_provavel').length;
  
  return (
    <div className="space-y-6">
      <AlertDialog open={confirmReativarOpen} onOpenChange={setConfirmReativarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Monitoramento está desativado/pausado</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTipo ? `${NOMES[confirmTipo] || confirmTipo} está desativado ou com pausa global. Deseja reativar e executar agora?` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmTipo(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmTipo) return;
                const tipo = confirmTipo;
                try {
                  await reativarConfig(tipo);
                  toast.success('Reativado. Iniciando execução...');
                  setConfirmTipo(null);
                  await executarAgora(tipo);
                } catch (e: any) {
                  toast.error(`Não foi possível reativar: ${e?.message || 'erro desconhecido'}`);
                }
              }}
            >
              Reativar e executar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header com resumo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dashboard de Monitoramentos</h2>
          <p className="text-sm text-muted-foreground">
            Status em tempo real de todos os robôs de monitoramento
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {totalOk} OK
          </Badge>
          {totalExecutando > 0 && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {totalExecutando} Executando
            </Badge>
          )}
          {totalErros > 0 && (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
              <XCircle className="h-3 w-3 mr-1" />
              {totalErros} Erros
            </Badge>
          )}
          
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>
      
      {/* Grid de cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statusMonitoramentos.map((status) => (
          <MonitoramentoCard 
            key={status.tipo}
            status={status}
            onExecutar={() => handleExecutar(status.tipo)}
            onCancelar={() => handleCancelar(status.tipo)}
            executando={executando[status.tipo] || false}
            cancelando={cancelando[status.tipo] || false}
          />
        ))}
      </div>
    </div>
  );
}
