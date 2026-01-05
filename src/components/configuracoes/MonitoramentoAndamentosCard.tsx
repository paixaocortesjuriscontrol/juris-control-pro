import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileText, Play, Clock, PlayCircle, RefreshCw, XCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  coordenacaoId: string;
}

const HORARIOS_DISPONIVEIS = [
  { value: '08:00', label: '08:00' },
  { value: '12:00', label: '12:00' },
  { value: '14:00', label: '14:00' },
  { value: '18:00', label: '18:00' },
  { value: '22:00', label: '22:00' },
];

export function MonitoramentoAndamentosCard({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();
  const canceladoRef = useRef(false);

  const [executando, setExecutando] = useState(false);
  const [executandoCompleto, setExecutandoCompleto] = useState(false);
  const [progresso, setProgresso] = useState<{ current: number; total: number; percentage: number } | null>(null);

  // Query para buscar configuração
  const { data: config, isLoading } = useQuery({
    queryKey: ['config-monitoramento', 'andamentos', coordenacaoId],
    queryFn: async () => {
      let query = supabase
        .from('configuracoes_monitoramento')
        .select('*')
        .eq('tipo', 'andamentos');
      
      if (coordenacaoId) {
        query = query.eq('coordenacao_id', coordenacaoId);
      } else {
        query = query.is('coordenacao_id', null);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Mutation para atualizar horários
  const atualizarHorarios = useMutation({
    mutationFn: async (horarios: string[]) => {
      if (!config?.id) {
        const { error } = await supabase
          .from('configuracoes_monitoramento')
          .insert({
            tipo: 'andamentos',
            coordenacao_id: coordenacaoId || null,
            horarios_execucao: horarios,
            ativo: true,
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('configuracoes_monitoramento')
          .update({ 
            horarios_execucao: horarios,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-monitoramento'] });
      toast.success('Horários atualizados!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const horariosSelecionados = (config?.horarios_execucao as string[]) || [];

  const handleToggleHorario = (horario: string) => {
    const novosHorarios = horariosSelecionados.includes(horario)
      ? horariosSelecionados.filter(h => h !== horario)
      : [...horariosSelecionados, horario];
    
    atualizarHorarios.mutate(novosHorarios);
  };

  const handleCancelar = () => {
    canceladoRef.current = true;
    toast.info("Cancelando após o lote atual...");
  };

  const handleExecutarLote = async () => {
    setExecutando(true);
    try {
      const { data, error } = await supabase.functions.invoke('monitorar-andamentos');
      if (error) throw error;
      
      const checked = data?.results?.checked || 0;
      const newMovements = data?.results?.newMovements || 0;
      const audienciasDetectadas = data?.results?.audienciasDetectadas || 0;
      const intimacoesDetectadas = data?.results?.intimacoesDetectadas || 0;
      
      let msg = `Lote concluído: ${checked} processos, ${newMovements} novos andamentos`;
      if (audienciasDetectadas > 0) msg += `, ${audienciasDetectadas} audiências`;
      if (intimacoesDetectadas > 0) msg += `, ${intimacoesDetectadas} intimações`;
      
      toast.success(msg);
      
      queryClient.invalidateQueries({ queryKey: ['config-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['audiencias-detectadas'] });
      queryClient.invalidateQueries({ queryKey: ['intimacoes-detectadas'] });
    } catch (error) {
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setExecutando(false);
    }
  };

  const handleExecutarCompleto = async () => {
    setExecutandoCompleto(true);
    setProgresso({ current: 0, total: 0, percentage: 0 });
    canceladoRef.current = false;
    
    try {
      let isComplete = false;
      let totalAndamentos = 0;
      let totalChecked = 0;
      let totalAudiencias = 0;
      let totalIntimacoes = 0;
      
      while (!isComplete && !canceladoRef.current) {
        const { data, error } = await supabase.functions.invoke('monitorar-andamentos');
        
        if (error) throw error;
        
        if (data?.progress) {
          setProgresso(data.progress);
        }
        
        totalChecked += data?.results?.checked || 0;
        totalAndamentos += data?.results?.newMovements || 0;
        totalAudiencias += data?.results?.audienciasDetectadas || 0;
        totalIntimacoes += data?.results?.intimacoesDetectadas || 0;
        isComplete = data?.isComplete || false;
      }
      
      if (canceladoRef.current) {
        toast.info(`Monitoramento cancelado: ${totalChecked} processos verificados`);
      } else {
        let msg = `Monitoramento completo: ${totalChecked} processos, ${totalAndamentos} novos andamentos`;
        if (totalAudiencias > 0) msg += `, ${totalAudiencias} audiências`;
        if (totalIntimacoes > 0) msg += `, ${totalIntimacoes} intimações`;
        toast.success(msg);
      }
    } catch (error) {
      toast.error(`Erro no monitoramento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setExecutandoCompleto(false);
      setProgresso(null);
      canceladoRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['config-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['audiencias-detectadas'] });
      queryClient.invalidateQueries({ queryKey: ['intimacoes-detectadas'] });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <RefreshCw className="h-6 w-6 text-primary animate-spin" />
          </div>
          <div>
            <CardTitle className="text-lg">Carregando...</CardTitle>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Monitoramento de Andamentos
              <span title="Detecta audiências automaticamente">
                <Calendar className="h-4 w-4 text-orange-500" />
              </span>
            </CardTitle>
            <CardDescription>
              Busca novos andamentos e detecta audiências automaticamente
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horários de Execução */}
        <div>
          <Label className="text-sm font-medium">Horários de Execução</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Selecione os horários para buscar andamentos e detectar audiências
          </p>
          
          <div className="flex flex-col gap-2">
            {HORARIOS_DISPONIVEIS.map((horario) => (
              <label
                key={horario.value}
                className={`
                  flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                  ${horariosSelecionados.includes(horario.value) 
                    ? 'bg-primary/10 border-primary' 
                    : 'hover:bg-muted'}
                `}
              >
                <Checkbox
                  checked={horariosSelecionados.includes(horario.value)}
                  onCheckedChange={() => handleToggleHorario(horario.value)}
                  disabled={atualizarHorarios.isPending}
                />
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{horario.label}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Última execução */}
        {config?.ultima_execucao && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground pt-4 border-t">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                Última execução: {format(toZonedTime(new Date(config.ultima_execucao), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
            {config.metadata && typeof config.metadata === 'object' && 'last_complete_run' in config.metadata && config.metadata.last_complete_run && (
              <span className="text-xs text-green-600 ml-6">
                Última execução completa: {format(toZonedTime(new Date(String(config.metadata.last_complete_run)), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        )}

        {/* Progresso do monitoramento completo */}
        {executandoCompleto && progresso && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span>Buscando andamentos e audiências...</span>
              <span>{progresso.current} de {progresso.total} ({progresso.percentage}%)</span>
            </div>
            <Progress value={progresso.percentage} className="h-2" />
          </div>
        )}

        {/* Botões de execução */}
        <div className="flex gap-2 pt-4 border-t">
          {executandoCompleto ? (
            <Button 
              onClick={handleCancelar} 
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleExecutarLote} 
                disabled={executando || executandoCompleto}
                className="flex-1"
                variant="outline"
              >
                {executando ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Executar Lote
                  </>
                )}
              </Button>
              
              <Button 
                onClick={handleExecutarCompleto} 
                disabled={executando || executandoCompleto}
                className="flex-1"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Executar Completo
              </Button>
            </>
          )}
        </div>

        {/* Nota explicativa */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Este monitoramento busca andamentos via DataJud/CNJ e detecta audiências 
            automaticamente nas movimentações, exibindo-as no Painel de Audiências.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
