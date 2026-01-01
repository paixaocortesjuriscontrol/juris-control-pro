import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileSearch, Loader2, RefreshCw, Clock } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  coordenacaoId: string;
}

export function MonitoramentoDjenProcessosCard({ coordenacaoId }: Props) {
  const [executando, setExecutando] = useState(false);
  const [progresso, setProgresso] = useState<{ processados: number; novas: number } | null>(null);
  const queryClient = useQueryClient();

  // Buscar configuração
  const { data: config, isLoading } = useQuery({
    queryKey: ['config-djen-processos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes_monitoramento')
        .select('*')
        .eq('tipo', 'djen_processos')
        .is('coordenacao_id', null)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Buscar estatísticas
  const { data: stats } = useQuery({
    queryKey: ['djen-processos-stats'],
    queryFn: async () => {
      const { count: totalPublicacoes } = await supabase
        .from('publicacoes_djen_processos')
        .select('*', { count: 'exact', head: true });

      const { count: naoLidas } = await supabase
        .from('publicacoes_djen_processos')
        .select('*', { count: 'exact', head: true })
        .eq('lida', false);

      const { count: processosMonitorados } = await supabase
        .from('processos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .eq('monitorar_andamentos', true);

      return {
        totalPublicacoes: totalPublicacoes || 0,
        naoLidas: naoLidas || 0,
        processosMonitorados: processosMonitorados || 0
      };
    },
    refetchInterval: 30000
  });

  // Buscar último histórico
  const { data: ultimoHistorico } = useQuery({
    queryKey: ['djen-processos-historico'],
    queryFn: async () => {
      const { data } = await supabase
        .from('historico_monitoramento')
        .select('*')
        .eq('tipo', 'djen_processos')
        .order('executado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    }
  });

  const handleExecutarManual = async () => {
    setExecutando(true);
    setProgresso(null);

    try {
      const { data, error } = await supabase.functions.invoke('monitorar-djen-processos');

      if (error) throw error;

      setProgresso({
        processados: data.processados || 0,
        novas: data.novas || 0
      });

      queryClient.invalidateQueries({ queryKey: ['djen-processos-stats'] });
      queryClient.invalidateQueries({ queryKey: ['djen-processos-historico'] });
      queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });

      toast.success(`Monitoramento concluído: ${data.novas || 0} novas publicações encontradas`);
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro ao executar monitoramento');
    } finally {
      setExecutando(false);
    }
  };

  const handleFrequenciaChange = async (value: string) => {
    if (!config?.id) return;
    const { error } = await supabase
      .from('configuracoes_monitoramento')
      .update({ frequencia: value })
      .eq('id', config.id);
    if (error) {
      toast.error('Erro ao atualizar frequência');
    } else {
      queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
      toast.success('Frequência atualizada');
    }
  };

  const handleAtivoChange = async (checked: boolean) => {
    if (!config?.id) return;
    const { error } = await supabase
      .from('configuracoes_monitoramento')
      .update({ ativo: checked })
      .eq('id', config.id);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      queryClient.invalidateQueries({ queryKey: ['config-djen-processos'] });
      toast.success(checked ? 'Monitoramento ativado' : 'Monitoramento desativado');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileSearch className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">DJEN por Processo</CardTitle>
              <CardDescription className="text-xs">
                Busca publicações no DJEN para processos cadastrados
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={config?.ativo ?? false}
            onCheckedChange={handleAtivoChange}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-semibold">{stats?.processosMonitorados || 0}</p>
            <p className="text-xs text-muted-foreground">Processos</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-semibold">{stats?.totalPublicacoes || 0}</p>
            <p className="text-xs text-muted-foreground">Publicações</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-semibold text-orange-600">{stats?.naoLidas || 0}</p>
            <p className="text-xs text-muted-foreground">Não lidas</p>
          </div>
        </div>

        {/* Frequência */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Frequência</span>
          <Select
            value={config?.frequencia || 'diario'}
            onValueChange={handleFrequenciaChange}
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário</SelectItem>
              <SelectItem value="2x_dia">2x ao dia</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Última execução */}
        {ultimoHistorico && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Última execução: {format(new Date(ultimoHistorico.executado_em), "dd/MM HH:mm", { locale: ptBR })}
            </span>
            {ultimoHistorico.novos_andamentos > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{ultimoHistorico.novos_andamentos} novas
              </Badge>
            )}
          </div>
        )}

        {/* Progresso */}
        {progresso && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <span>{progresso.processados} processos verificados, {progresso.novas} novas publicações</span>
          </div>
        )}

        {/* Botão executar */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleExecutarManual}
          disabled={executando}
        >
          {executando ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Executar Agora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
