import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Zap, Play, Clock, RefreshCw, ChevronDown, FileText, StopCircle, Trash2, CalendarIcon, XCircle, RotateCcw, Bomb } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { useDjenTermosPro } from "@/hooks/useDjenTermosPro";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { HorarioAgendadoInfo } from "./HorarioAgendadoInfo";
import { withTimeout } from "@/utils/withTimeout";

interface Props {
  coordenacaoId: string;
}

export function MonitoramentoTermosProCard({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();
  const { 
    configuracaoTermosPro,
    isLoading, 
    atualizarConfiguracao 
  } = useConfiguracoesMonitoramento(coordenacaoId);

  // Hook do engine Pro (singleton correto)
  const {
    progress,
    isRunning,
    canResume,
    checkpoint,
    executar,
    retomar,
    cancelar,
    limpar,
    forceKill,
  } = useDjenTermosPro();

  // Filtros por coordenação e termo
  const [filtroCoordenacaoId, setFiltroCoordenacaoId] = useState<string>('');
  const [filtroMonitoramentoId, setFiltroMonitoramentoId] = useState<string>('');

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const coordenacaoFiltroEfetivo = filtroCoordenacaoId || null;

  const { data: monitoramentos = [] } = useQuery({
    queryKey: ['monitoramentos-djen-coord-termos-pro', coordenacaoFiltroEfetivo],
    queryFn: async () => {
      if (!coordenacaoFiltroEfetivo) return [];
      const { data, error } = await supabase
        .from('monitoramentos_djen')
        .select('id, termo_busca, descricao, tipo, oab, uf')
        .eq('coordenacao_id', coordenacaoFiltroEfetivo)
        .eq('ativo', true);
      if (error) throw error;
      const list = (data || []) as { id: string; termo_busca: string; descricao?: string; tipo?: string; oab?: string; uf?: string }[];
      const getLabel = (m: typeof list[0]) =>
        m.descricao || m.termo_busca || `${m.tipo || 'Termo'} ${m.oab || ''} ${m.uf || ''}`.trim() || m.id.slice(0, 8);
      return list.sort((a, b) => getLabel(a).localeCompare(getLabel(b), 'pt-BR', { sensitivity: 'base' }));
    },
    enabled: !!coordenacaoFiltroEfetivo,
  });

  useEffect(() => {
    if (!filtroCoordenacaoId) setFiltroMonitoramentoId('');
  }, [filtroCoordenacaoId]);

  const [statsOpen, setStatsOpen] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [dialogRetomada, setDialogRetomada] = useState(false);
  
  // Estados para período de consulta
  const [dataInicio, setDataInicio] = useState<Date>(new Date());
  const [dataFim, setDataFim] = useState<Date>(new Date());

  // CONTADORES REAIS DO BANCO (publicações persistidas hoje)
  const { data: statsHoje } = useQuery({
    queryKey: ['termos-pro-stats-hoje'],
    queryFn: async () => {
      const hoje = new Date();
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0).toISOString();
      const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString();

      const { count: novas } = await supabase
        .from('publicacoes_djen')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      const { count: descartadas } = await supabase
        .from('publicacoes_djen_descartadas')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioDia)
        .lte('created_at', fimDia);

      const { count: monitoramentosCount } = await supabase
        .from('monitoramentos_djen')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);

      return {
        novas: novas ?? 0,
        descartadas: descartadas ?? 0,
        monitoramentos: monitoramentosCount ?? 0,
      };
    },
    refetchInterval: 10000,
  });

  // Obter IDs filtrados para execução
  const getMonitoramentoIdsFiltrados = (): string[] | undefined => {
    if (filtroMonitoramentoId) return [filtroMonitoramentoId];
    if (filtroCoordenacaoId && monitoramentos.length > 0) {
      return monitoramentos.map(m => m.id);
    }
    return undefined;
  };

  const formatYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleExecutarManual = () => {
    if (isRunning) {
      toast.warning('Já existe uma execução Termos Pro em andamento.');
      return;
    }
    
    if (canResume) {
      setDialogRetomada(true);
      return;
    }
    
    const ids = getMonitoramentoIdsFiltrados();
    executar(formatYmd(dataInicio), formatYmd(dataFim), filtroCoordenacaoId || undefined, ids);
  };

  const handleConfirmarRetomada = (resumir: boolean) => {
    setDialogRetomada(false);
    if (resumir) {
      retomar(filtroCoordenacaoId || undefined, getMonitoramentoIdsFiltrados());
    } else {
      const ids = getMonitoramentoIdsFiltrados();
      executar(formatYmd(dataInicio), formatYmd(dataFim), filtroCoordenacaoId || undefined, ids);
    }
  };

  const handleFrequenciaChange = (frequencia: string) => {
    if (configuracaoTermosPro) {
      atualizarConfiguracao.mutate({ id: configuracaoTermosPro.id, frequencia, tipo: 'termos_pro' });
    }
  };

  const handleAtivoChange = (ativo: boolean) => {
    if (configuracaoTermosPro) {
      atualizarConfiguracao.mutate({ id: configuracaoTermosPro.id, ativo, tipo: 'termos_pro' });
    }
  };

  const handleCancelarExecucao = () => {
    cancelar();
    toast.success('Execução cancelada');
  };

  const handleForceKill = () => {
    forceKill(true);
  };

  const handleLimparApenas = async () => {
    if (!confirm('Isso vai limpar TODAS as publicações capturadas hoje. Deseja continuar?')) return;

    setLimpando(true);
    try {
      if (isRunning) {
        cancelar();
        await new Promise((r) => setTimeout(r, 500));
      }

      const { data, error } = await withTimeout(
        supabase.functions.invoke('limpar-djen-hoje'),
        180_000,
        'A limpeza demorou mais que 180s.'
      );
      if (error) throw error;

      toast.success((data as any)?.message ?? 'Limpeza concluída!');
      
      queryClient.invalidateQueries({ queryKey: ['termos-pro-stats-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-unificadas'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-djen'] });
    } catch (error) {
      console.error('Erro ao limpar:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setLimpando(false);
    }
  };

  // Tempo formatado
  const formatTempo = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            DJEN Termos Pro
          </CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
    {/* Diálogo de Retomada */}
    <AlertDialog open={dialogRetomada} onOpenChange={setDialogRetomada}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Execução Anterior Incompleta
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Foi encontrado um checkpoint do monitoramento:</p>
            {checkpoint && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex justify-between">
                  <span>Período:</span>
                  <span className="font-medium">{checkpoint.dataInicioYmd} → {checkpoint.dataFimYmd}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Novas encontradas:</span>
                  <span className="font-medium">{checkpoint.novas}</span>
                </div>
              </div>
            )}
            <p className="text-sm">
              Deseja <strong>continuar de onde parou</strong> ou <strong>iniciar do zero</strong>?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="outline" onClick={() => handleConfirmarRetomada(false)}>
            <Play className="h-4 w-4 mr-2" />
            Iniciar do Zero
          </Button>
          <AlertDialogAction onClick={() => handleConfirmarRetomada(true)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Continuar de onde parou
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">DJEN Termos Pro</CardTitle>
              <Badge variant="outline" className="text-xs">Novo</Badge>
            </div>
            <CardDescription>Motor de alta precisão com validação por metadados estruturados da API PJE Comunica</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros: Coordenação e Termos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Coordenação</label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
              value={filtroCoordenacaoId}
              onChange={(e) => setFiltroCoordenacaoId(e.target.value)}
              disabled={isRunning}
            >
              <option value="">Todas</option>
              {coordenacoes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          {coordenacaoFiltroEfetivo && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Termo</label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-70"
                value={filtroMonitoramentoId}
                onChange={(e) => setFiltroMonitoramentoId(e.target.value)}
                disabled={isRunning}
              >
                <option value="">Todos</option>
                {monitoramentos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.descricao || m.termo_busca || `${m.tipo || 'Termo'} ${m.oab || ''} ${m.uf || ''}`.trim() || m.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isRunning && (filtroCoordenacaoId || filtroMonitoramentoId) && (
          <div className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-xs text-primary font-medium">
            Executando: {coordenacoes.find((c) => c.id === filtroCoordenacaoId)?.nome ?? 'Todas'}
            {filtroMonitoramentoId && (
              <> • {monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.descricao || monitoramentos.find((m) => m.id === filtroMonitoramentoId)?.termo_busca || 'Termo'}</>
            )}
          </div>
        )}

        {/* Toggle Ativo/Inativo */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="termos-pro-ativo">Monitoramento Ativo</Label>
            <p className="text-sm text-muted-foreground">
              {configuracaoTermosPro?.ativo ? "Ativo" : "Pausado"}
            </p>
          </div>
          <Switch
            id="termos-pro-ativo"
            checked={configuracaoTermosPro?.ativo ?? false}
            onCheckedChange={handleAtivoChange}
          />
        </div>

        {/* Frequência */}
        <div className="space-y-2">
          <Label>Frequência de Execução</Label>
          <Select
            value={configuracaoTermosPro?.frequencia ?? 'diario'}
            onValueChange={handleFrequenciaChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário (9h BRT)</SelectItem>
              <SelectItem value="2x_dia">2x ao dia (9h e 14h BRT)</SelectItem>
              <SelectItem value="3x_dia">3x ao dia (8h, 12h e 17h BRT)</SelectItem>
              <SelectItem value="desativado">Desativado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Horário agendado */}
        <HorarioAgendadoInfo 
          horariosExecucao={configuracaoTermosPro?.horarios_execucao}
          frequencia={configuracaoTermosPro?.frequencia}
        />

        {/* Última execução */}
        {configuracaoTermosPro?.ultima_execucao && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Última execução: {format(toZonedTime(new Date(configuracaoTermosPro.ultima_execucao), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
        )}

        {/* CONTADORES REAIS DO BANCO */}
        <div className="p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Publicações Hoje</span>
            <Badge variant={isRunning ? "secondary" : "outline"} className="text-xs">
              {isRunning ? "Atualizando..." : "Atualizado"}
            </Badge>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 bg-background rounded border">
              <div className="text-lg font-bold">{(statsHoje?.novas ?? 0) + (statsHoje?.descartadas ?? 0)}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="p-2 bg-background rounded border">
              <div className="text-lg font-bold text-primary">{statsHoje?.novas ?? 0}</div>
              <div className="text-xs text-muted-foreground">Novas</div>
            </div>
            <div className="p-2 bg-background rounded border">
              <div className="text-lg font-bold text-destructive">{statsHoje?.descartadas ?? 0}</div>
              <div className="text-xs text-muted-foreground">Descartadas</div>
            </div>
            <div className="p-2 bg-background rounded border">
              <div className="text-lg font-bold text-muted-foreground">{statsHoje?.monitoramentos ?? 0}</div>
              <div className="text-xs text-muted-foreground">Termos</div>
            </div>
          </div>
        </div>

        {/* Progresso ao vivo do Engine Pro */}
        {isRunning && (
          <div className="space-y-3">
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {progress.diaAtualYmd && (
                    <span className="text-muted-foreground mr-1">[{progress.diaAtualYmd}]</span>
                  )}
                  Processando: {progress.globalCurrent}/{progress.globalTotal}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatTempo(progress.tempoDecorrido)}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {progress.percentage}%
                  </Badge>
                </div>
              </div>
              <Progress value={progress.percentage} className="h-2" />
              
              {progress.totalDias > 1 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Dia {progress.diaAtualIndice}/{progress.totalDias} • 
                  Termo {progress.termoAtualNoDia}/{progress.totalTermos}
                </div>
              )}
              
              {progress.termoAtual && (
                <div className="mt-2 text-xs text-muted-foreground truncate">
                  Buscando: {progress.termoAtual}
                </div>
              )}
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-primary">✓ {progress.novas} novas</span>
                <span className="text-muted-foreground">↔ {progress.duplicadas} duplicadas</span>
                <span className="text-destructive">✕ {progress.descartadas} descartadas</span>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelarExecucao}
              className="w-full"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Cancelar Execução
            </Button>
          </div>
        )}

        {/* Status concluído/erro/cancelado */}
        {!isRunning && progress.status === 'concluido' && progress.novas > 0 && (
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30 text-sm">
            <span className="font-medium text-emerald-700">✓ Concluído!</span>
            <span className="text-muted-foreground ml-2">
              {progress.novas} novas, {progress.duplicadas} duplicadas, {progress.descartadas} descartadas
              em {formatTempo(progress.tempoDecorrido)}
            </span>
          </div>
        )}

        {!isRunning && progress.status === 'erro' && (
          <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="font-medium">Erro na execução</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">{progress.mensagem}</p>
          </div>
        )}

        {/* Período de consulta */}
        <div className="space-y-2">
          <Label>Período de Consulta</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Data Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataInicio} onSelect={(date) => date && setDataInicio(date)} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Data Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataFim} onSelect={(date) => date && setDataFim(date)} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Botões de execução */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleExecutarManual} 
            disabled={isRunning || limpando}
            className="flex-1"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Executar Agora
              </>
            )}
          </Button>
          
          <Button 
            variant="outline"
            onClick={handleLimparApenas} 
            disabled={limpando || isRunning}
            className="sm:w-auto"
          >
            {limpando ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Limpando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Dados de Hoje
              </>
            )}
          </Button>

          {(isRunning || progress.status !== 'idle') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleForceKill}
              className="text-destructive hover:text-destructive sm:w-auto"
              title="Reset total - para execução e limpa checkpoint"
            >
              <Bomb className="h-4 w-4 mr-1" />
              Reset Total
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
    </>
  );
}
