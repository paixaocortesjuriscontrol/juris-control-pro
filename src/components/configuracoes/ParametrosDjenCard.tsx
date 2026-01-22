import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, Save, RotateCcw, ChevronDown, Zap, Clock, Shield, AlertTriangle } from "lucide-react";

interface ParametrosDjen {
  id: string;
  modo_processamento: 'sequencial' | 'semi_paralelo' | 'paralelo_total';
  max_paralelo: number;
  max_por_invocacao: number;
  delay_entre_monitoramentos: number;
  delay_entre_paginas: number;
  delay_entre_tribunais: number;
  delay_jina_api: number;
  soft_timeout_ms: number;
  finalization_buffer_ms: number;
  max_retries: number;
  retry_base_delay_ms: number;
  descricao: string | null;
  ativo: boolean;
}

const DEFAULTS: Omit<ParametrosDjen, 'id' | 'descricao' | 'ativo'> = {
  modo_processamento: 'semi_paralelo',
  max_paralelo: 5,
  max_por_invocacao: 10,
  delay_entre_monitoramentos: 500,
  delay_entre_paginas: 300,
  delay_entre_tribunais: 200,
  delay_jina_api: 2000,
  soft_timeout_ms: 50000,
  finalization_buffer_ms: 10000,
  max_retries: 3,
  retry_base_delay_ms: 2000,
};

async function fetchParametros(): Promise<ParametrosDjen | null> {
  // Usar PostgrestBuilder genérico para evitar problemas de tipo
  const { data, error } = await (supabase as any)
    .from('parametros_monitoramento_djen')
    .select('*')
    .eq('ativo', true)
    .limit(1)
    .single();

  if (error) {
    console.error('Erro ao buscar parâmetros:', error);
    return null;
  }
  return data as ParametrosDjen;
}

async function updateParametros(id: string, updates: Partial<ParametrosDjen>): Promise<void> {
  const { error } = await (supabase as any)
    .from('parametros_monitoramento_djen')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export function ParametrosDjenCard() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);
  const [localParams, setLocalParams] = useState<Partial<ParametrosDjen> | null>(null);

  const { data: parametros, isLoading } = useQuery({
    queryKey: ['parametros-djen'],
    queryFn: fetchParametros,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<ParametrosDjen>) => {
      if (!parametros?.id) throw new Error('Parâmetros não encontrados');
      await updateParametros(parametros.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parametros-djen'] });
      setLocalParams(null);
      toast.success('Parâmetros atualizados com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const currentParams = localParams ? { ...parametros, ...localParams } : parametros;

  const handleChange = (field: keyof ParametrosDjen, value: any) => {
    setLocalParams(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (localParams) {
      updateMutation.mutate(localParams);
    }
  };

  const handleReset = () => {
    setLocalParams(DEFAULTS);
    toast.info('Valores padrão carregados. Clique em Salvar para aplicar.');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Parâmetros DJEN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!parametros) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Parâmetros DJEN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma configuração encontrada. Execute a migration para criar a tabela.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasChanges = localParams !== null;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Parâmetros de Processamento DJEN</CardTitle>
                  <CardDescription>
                    Configure a estratégia e velocidade do monitoramento
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning">
                    Alterações não salvas
                  </Badge>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Modo de Processamento */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Estratégia de Processamento</Label>
              </div>
              <Select
                value={currentParams?.modo_processamento || 'semi_paralelo'}
                onValueChange={(v) => handleChange('modo_processamento', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequencial">
                    <div className="flex items-center gap-2">
                      <span>🐢 Sequencial</span>
                      <span className="text-xs text-muted-foreground">(1 por vez - mais lento, menos risco)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="semi_paralelo">
                    <div className="flex items-center gap-2">
                      <span>⚡ Semi-paralelo</span>
                      <span className="text-xs text-muted-foreground">(N simultâneos - equilibrado)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="paralelo_total">
                    <div className="flex items-center gap-2">
                      <span>🚀 Paralelo total</span>
                      <span className="text-xs text-muted-foreground">(todos juntos - mais rápido, mais risco)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Controle de Concorrência */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm">Máx. Paralelo: {currentParams?.max_paralelo || 5}</Label>
                <Slider
                  value={[currentParams?.max_paralelo || 5]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={([v]) => handleChange('max_paralelo', v)}
                  disabled={currentParams?.modo_processamento === 'sequencial'}
                />
                <p className="text-xs text-muted-foreground">
                  Quantos monitoramentos processar simultaneamente
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Máx. por Invocação: {currentParams?.max_por_invocacao || 10}</Label>
                <Slider
                  value={[currentParams?.max_por_invocacao || 10]}
                  min={1}
                  max={30}
                  step={1}
                  onValueChange={([v]) => handleChange('max_por_invocacao', v)}
                />
                <p className="text-xs text-muted-foreground">
                  Quantos processar antes de encerrar a invocação
                </p>
              </div>
            </div>

            {/* Delays */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Delays (milissegundos)</Label>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-xs">Entre Monitoramentos</Label>
                  <Input
                    type="number"
                    value={currentParams?.delay_entre_monitoramentos || 500}
                    onChange={(e) => handleChange('delay_entre_monitoramentos', parseInt(e.target.value))}
                    min={0}
                    max={10000}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Entre Páginas</Label>
                  <Input
                    type="number"
                    value={currentParams?.delay_entre_paginas || 300}
                    onChange={(e) => handleChange('delay_entre_paginas', parseInt(e.target.value))}
                    min={0}
                    max={5000}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Entre Tribunais</Label>
                  <Input
                    type="number"
                    value={currentParams?.delay_entre_tribunais || 200}
                    onChange={(e) => handleChange('delay_entre_tribunais', parseInt(e.target.value))}
                    min={0}
                    max={5000}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">API Jina (fallback)</Label>
                  <Input
                    type="number"
                    value={currentParams?.delay_jina_api || 2000}
                    onChange={(e) => handleChange('delay_jina_api', parseInt(e.target.value))}
                    min={1000}
                    max={10000}
                  />
                </div>
              </div>
            </div>

            {/* Timeouts */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Timeouts e Retries</Label>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-xs">Soft Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={currentParams?.soft_timeout_ms || 50000}
                    onChange={(e) => handleChange('soft_timeout_ms', parseInt(e.target.value))}
                    min={20000}
                    max={120000}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Buffer Finalização (ms)</Label>
                  <Input
                    type="number"
                    value={currentParams?.finalization_buffer_ms || 10000}
                    onChange={(e) => handleChange('finalization_buffer_ms', parseInt(e.target.value))}
                    min={5000}
                    max={30000}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Máx. Retries</Label>
                  <Input
                    type="number"
                    value={currentParams?.max_retries || 3}
                    onChange={(e) => handleChange('max_retries', parseInt(e.target.value))}
                    min={1}
                    max={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Base Delay Retry (ms)</Label>
                  <Input
                    type="number"
                    value={currentParams?.retry_base_delay_ms || 2000}
                    onChange={(e) => handleChange('retry_base_delay_ms', parseInt(e.target.value))}
                    min={500}
                    max={10000}
                  />
                </div>
              </div>
            </div>

            {/* Dica sobre configurações */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-border">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Dicas de configuração:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Mais rápido:</strong> Paralelo total + max_paralelo alto + delays baixos (risco de rate limit)</li>
                  <li><strong>Mais estável:</strong> Semi-paralelo + max_paralelo 3-5 + delays médios</li>
                  <li><strong>Mais seguro:</strong> Sequencial + delays altos (lento mas sem risco)</li>
                </ul>
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || updateMutation.isPending}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Salvar Alterações
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar Padrões
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
