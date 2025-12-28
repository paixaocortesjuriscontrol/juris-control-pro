import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Newspaper, Play, Clock, RefreshCw } from "lucide-react";
import { useConfiguracoesMonitoramento } from "@/hooks/useConfiguracoesMonitoramento";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  coordenacaoId: string;
}

export function MonitoramentoDjenCard({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();
  const { 
    configuracaoDjen,
    isLoading, 
    atualizarConfiguracao 
  } = useConfiguracoesMonitoramento(coordenacaoId);

  const [executando, setExecutando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, novas: 0 });

  const handleExecutarManual = async () => {
    setExecutando(true);
    setProgresso({ atual: 0, total: 0, novas: 0 });
    
    let offset = 0;
    let totalProcessados = 0;
    let totalNovas = 0;
    let hasMore = true;
    
    try {
      // Get total count first
      const { count } = await supabase
        .from('monitoramentos_djen')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);
      
      const total = count || 0;
      setProgresso(p => ({ ...p, total }));
      
      // Process in batches
      while (hasMore) {
        toast.info(`Processando lote ${Math.floor(offset / 10) + 1}...`);
        
        const { data, error } = await supabase.functions.invoke('monitorar-djen', {
          body: null,
          headers: {},
        });
        
        // Pass offset as query param by calling with different approach
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://bfxahrrvoqxcdmfsvnrk.supabase.co'}/functions/v1/monitorar-djen?offset=${offset}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        totalProcessados += result.processados || 0;
        totalNovas += result.novasPublicacoes || 0;
        hasMore = result.hasMore || false;
        
        setProgresso({ 
          atual: totalProcessados, 
          total, 
          novas: totalNovas 
        });
        
        if (hasMore && result.nextOffset) {
          offset = result.nextOffset;
          // Small delay between batches
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      toast.success(`Monitoramento concluído: ${totalProcessados} verificados, ${totalNovas} novas publicações`);
      queryClient.invalidateQueries({ queryKey: ['configuracoes-monitoramento'] });
      
    } catch (error) {
      console.error('Erro no monitoramento:', error);
      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setExecutando(false);
      setProgresso({ atual: 0, total: 0, novas: 0 });
    }
  };

  const handleFrequenciaChange = (frequencia: string) => {
    if (configuracaoDjen) {
      atualizarConfiguracao.mutate({ id: configuracaoDjen.id, frequencia, tipo: 'djen' });
    }
  };

  const handleAtivoChange = (ativo: boolean) => {
    if (configuracaoDjen) {
      atualizarConfiguracao.mutate({ id: configuracaoDjen.id, ativo, tipo: 'djen' });
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

  const progressPercent = progresso.total > 0 
    ? Math.round((progresso.atual / progresso.total) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Newspaper className="h-6 w-6 text-orange-500" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">Monitoramento DJEN</CardTitle>
          <CardDescription>
            Busca publicações no Diário de Justiça Eletrônico
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status e Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ativo-djen">Monitoramento Ativo</Label>
            <p className="text-sm text-muted-foreground">
              {configuracaoDjen?.ativo ? "Executando automaticamente" : "Pausado"}
            </p>
          </div>
          <Switch
            id="ativo-djen"
            checked={configuracaoDjen?.ativo ?? true}
            onCheckedChange={handleAtivoChange}
            disabled={atualizarConfiguracao.isPending}
          />
        </div>

        {/* Frequência */}
        <div className="space-y-2">
          <Label htmlFor="frequencia-djen">Frequência de Execução</Label>
          <Select 
            value={configuracaoDjen?.frequencia || '2x_dia'} 
            onValueChange={handleFrequenciaChange}
            disabled={atualizarConfiguracao.isPending}
          >
            <SelectTrigger id="frequencia-djen">
              <SelectValue placeholder="Selecione a frequência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário (8h BRT)</SelectItem>
              <SelectItem value="2x_dia">2x ao dia (8h e 18h BRT)</SelectItem>
              <SelectItem value="semanal">Semanal (Segunda 8h BRT)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Última execução */}
        {configuracaoDjen?.ultima_execucao && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                Última execução: {format(toZonedTime(new Date(configuracaoDjen.ultima_execucao), 'America/Sao_Paulo'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>
        )}

        {/* Progress */}
        {executando && progresso.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processando: {progresso.atual}/{progresso.total}</span>
              <span className="text-green-600">+{progresso.novas} novas</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Botão de execução */}
        <Button 
          onClick={handleExecutarManual} 
          disabled={executando}
          className="w-full"
        >
          {executando ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Processando... {progressPercent > 0 ? `${progressPercent}%` : ''}
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Executar Agora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
