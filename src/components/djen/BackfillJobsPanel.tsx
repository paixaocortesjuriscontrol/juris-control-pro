import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Play,
  Square,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBackfillJobs, BackfillJob } from '@/hooks/useBackfillJobs';
import { cn } from '@/lib/utils';

interface BackfillJobsPanelProps {
  monitoramentos?: { id: string; termo_busca: string; descricao?: string }[];
  enabled?: boolean;
}

export function BackfillJobsPanel({ monitoramentos = [], enabled = true }: BackfillJobsPanelProps) {
  const { jobs, loading, creating, activeJob, createJob, cancelJob, deleteJob, fetchJobs } = useBackfillJobs(enabled);
  
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [monitoramentoId, setMonitoramentoId] = useState<string>('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!dataInicio || !dataFim) {
      return;
    }
    await createJob(dataInicio, dataFim, monitoramentoId || undefined);
    setDataInicio('');
    setDataFim('');
    setMonitoramentoId('');
  };

  const getStatusBadge = (status: BackfillJob['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Aguardando</Badge>;
      case 'running':
        return <Badge variant="default" className="flex items-center gap-1 bg-blue-500"><Loader2 className="w-3 h-3 animate-spin" /> Em execução</Badge>;
      case 'completed':
        return <Badge variant="default" className="flex items-center gap-1 bg-green-500"><CheckCircle className="w-3 h-3" /> Concluído</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Cancelado</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), "dd/MM/yy HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getProgressPercent = (job: BackfillJob) => {
    if (!job.progresso?.total || job.progresso.total === 0) return 0;
    return Math.round((job.progresso.processados / job.progresso.total) * 100);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Backfill Histórico (Server-Side)
            </CardTitle>
            <CardDescription>
              Busca publicações antigas em background. O navegador pode ser fechado.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchJobs} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new job form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-muted/30">
          <div className="space-y-1">
            <Label className="text-xs">Data Início</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              disabled={creating || !!activeJob}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data Fim</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              disabled={creating || !!activeJob}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monitoramento (opcional)</Label>
            <Select 
              value={monitoramentoId || "all"} 
              onValueChange={(val) => setMonitoramentoId(val === "all" ? "" : val)}
              disabled={creating || !!activeJob}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os monitoramentos</SelectItem>
                {monitoramentos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.descricao || m.termo_busca}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button 
              onClick={handleCreate} 
              disabled={creating || !dataInicio || !dataFim || !!activeJob}
              className="w-full"
            >
              {creating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
              ) : activeJob ? (
                <><Clock className="w-4 h-4 mr-2" /> Job em execução</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Iniciar Backfill</>
              )}
            </Button>
          </div>
        </div>

        {/* Jobs list */}
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum job de backfill encontrado
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {jobs.map((job) => (
                <Collapsible 
                  key={job.id}
                  open={expandedJobId === job.id}
                  onOpenChange={(open) => setExpandedJobId(open ? job.id : null)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 hover:bg-muted/50">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          {getStatusBadge(job.status)}
                          <div className="text-sm truncate w-full">
                            <span className="font-medium">
                              {format(parseISO(job.data_inicio), "dd/MM/yy")} - {format(parseISO(job.data_fim), "dd/MM/yy")}
                            </span>
                            {job.status === 'running' && job.progresso && (
                              <span className="ml-2 text-muted-foreground">({getProgressPercent(job)}%)</span>
                            )}

                            {/* Inline progress (visible without expanding) */}
                            {(job.status === 'running' || job.status === 'completed') && job.progresso && (
                              <div className="mt-2 pr-3">
                                <Progress value={getProgressPercent(job)} className="h-2" />
                              </div>
                            )}
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      <div className="flex items-center gap-2">
                        {(job.status === 'running' || job.status === 'pending') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); cancelJob(job.id); }}
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        )}
                        {(job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}

                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label="Expandir detalhes">
                            {expandedJobId === job.id ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                    
                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-3 border-t">
                        {/* Progress bar */}
                        {(job.status === 'running' || job.status === 'completed') && job.progresso && (
                          <div className="pt-3">
                            <Progress value={getProgressPercent(job)} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>{job.progresso.processados} / {job.progresso.total}</span>
                              <span>{getProgressPercent(job)}%</span>
                            </div>
                          </div>
                        )}

                        {/* Stats */}
                        {job.progresso && (
                          <div className="grid grid-cols-4 gap-2 text-xs pt-2">
                            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
                              <div className="font-bold text-green-600">{job.progresso.novas}</div>
                              <div className="text-muted-foreground">Novas</div>
                            </div>
                            <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950 rounded">
                              <div className="font-bold text-yellow-600">{job.progresso.descartadas}</div>
                              <div className="text-muted-foreground">Descartadas</div>
                            </div>
                            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
                              <div className="font-bold text-blue-600">{job.progresso.duplicadas}</div>
                              <div className="text-muted-foreground">Duplicadas</div>
                            </div>
                            <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded">
                              <div className="font-bold text-red-600">{job.progresso.erros}</div>
                              <div className="text-muted-foreground">Erros</div>
                            </div>
                          </div>
                        )}

                        {/* Timestamps */}
                        <div className="text-xs text-muted-foreground space-y-1 pt-2">
                          <div>Criado: {formatDate(job.created_at)}</div>
                          {job.started_at && <div>Iniciado: {formatDate(job.started_at)}</div>}
                          {job.completed_at && <div>Finalizado: {formatDate(job.completed_at)}</div>}
                        </div>

                        {/* Error */}
                        {job.erro && (
                          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                            {job.erro}
                          </div>
                        )}

                        {/* Logs */}
                        {job.logs && job.logs.length > 0 && (
                          <div className="pt-2">
                            <Label className="text-xs">Últimos logs:</Label>
                            <ScrollArea className="h-24 mt-1 border rounded p-2 bg-muted/30">
                              <div className="text-xs font-mono space-y-1">
                                {job.logs.slice(-10).map((log, i) => (
                                  <div key={i} className="text-muted-foreground">{log}</div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
