import { useEffect, useState } from "react";
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
  tipo_monitoramento_id: string;
  modo_processamento: 'sequencial' | 'semi_paralelo' | 'paralelo_total';
  max_paralelo: number;
  max_por_invocacao: number;
  batch_size: number;
  group_search_size: number;
  delay_entre_lotes: number;
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

const DEFAULTS: Omit<ParametrosDjen, 'id' | 'descricao' | 'ativo' | 'tipo_monitoramento_id'> = {
  modo_processamento: 'semi_paralelo',
  max_paralelo: 5,
  max_por_invocacao: 10,
  batch_size: 50,
  group_search_size: 50,
  delay_entre_lotes: 3000,
  delay_entre_monitoramentos: 500,
  delay_entre_paginas: 300,
  delay_entre_tribunais: 200,
  delay_jina_api: 2000,
  soft_timeout_ms: 50000,
  finalization_buffer_ms: 10000,
  max_retries: 3,
  retry_base_delay_ms: 2000,
};

const PRESETS: Record<string, Omit<ParametrosDjen, 'id' | 'descricao' | 'ativo' | 'tipo_monitoramento_id'>> = {
  conservador: {
    modo_processamento: 'sequencial',
    max_paralelo: 1,
    max_por_invocacao: 3,
    batch_size: 50,
    group_search_size: 50,
    delay_entre_lotes: 3000,
    delay_entre_monitoramentos: 2000,
    delay_entre_paginas: 1500,
    delay_entre_tribunais: 1200,
    delay_jina_api: 2000,
    soft_timeout_ms: 50000,
    finalization_buffer_ms: 10000,
    max_retries: 4,
    retry_base_delay_ms: 8000,
  },
  equilibrado: {
    modo_processamento: 'semi_paralelo',
    max_paralelo: 2,
    max_por_invocacao: 5,
    batch_size: 50,
    group_search_size: 50,
    delay_entre_lotes: 3000,
    delay_entre_monitoramentos: 800,
    delay_entre_paginas: 600,
    delay_entre_tribunais: 600,
    delay_jina_api: 2000,
    soft_timeout_ms: 50000,
    finalization_buffer_ms: 10000,
    max_retries: 3,
    retry_base_delay_ms: 4000,
  },
  turbo: {
    modo_processamento: 'semi_paralelo',
    max_paralelo: 4,
    max_por_invocacao: 8,
    batch_size: 50,
    group_search_size: 50,
    delay_entre_lotes: 3000,
    delay_entre_monitoramentos: 400,
    delay_entre_paginas: 300,
    delay_entre_tribunais: 300,
    delay_jina_api: 1500,
    soft_timeout_ms: 50000,
    finalization_buffer_ms: 10000,
    max_retries: 2,
    retry_base_delay_ms: 2000,
  },
};

interface TipoMonitoramento {
  id: string;
  slug: string;
  nome: string;
  ativo: boolean;
}

async function fetchParametros(tipoId: string): Promise<ParametrosDjen | null> {
  // Usar PostgrestBuilder genérico para evitar problemas de tipo
  const { data, error } = await (supabase as any)
    .from('parametros_monitoramento_djen')
    .select('*')
    .eq('tipo_monitoramento_id', tipoId)
    .limit(1)
    .single();

  if (error) {
    console.error('Erro ao buscar parâmetros:', error);
    return null;
  }
  return data as ParametrosDjen;
}

async function fetchTipos(): Promise<TipoMonitoramento[]> {
  const { data, error } = await (supabase as any)
    .from('tipo_monitoramento')
    .select('id, slug, nome, ativo')
    .eq('ativo', true)
    .order('nome');

  if (error) {
    console.error('Erro ao buscar tipos:', error);
    return [];
  }
  return data as TipoMonitoramento[];
}

async function updateParametros(id: string, updates: Partial<ParametrosDjen>): Promise<void> {
  const { error } = await (supabase as any)
    .from('parametros_monitoramento_djen')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

async function createParametros(tipoId: string): Promise<void> {
  const payload = {
    tipo_monitoramento_id: tipoId,
    ...DEFAULTS,
    ativo: true,
  };

  const { error } = await (supabase as any)
    .from('parametros_monitoramento_djen')
    .insert(payload);

  if (error) throw error;
}

export function ParametrosDjenCard() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);
  const [localParams, setLocalParams] = useState<Partial<ParametrosDjen> | null>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const { data: tipos } = useQuery({
    queryKey: ['tipos-monitoramento'],
    queryFn: fetchTipos,
  });

  const tipoAtual =
    tipos?.find((t) => t.id === tipoSelecionado) ||
    tipos?.find((t) => t.slug === 'djen_termos') ||
    tipos?.[0] ||
    null;

  useEffect(() => {
    if (!tipoSelecionado && tipoAtual?.id) {
      setTipoSelecionado(tipoAtual.id);
    }
  }, [tipoAtual, tipoSelecionado]);

  useEffect(() => {
    setLocalParams(null);
    setIsDirty(false);
  }, [tipoSelecionado]);

  const { data: parametros, isLoading } = useQuery({
    queryKey: ['parametros-djen', tipoAtual?.id],
    queryFn: () => fetchParametros(tipoAtual!.id),
    enabled: !!tipoAtual?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<ParametrosDjen>) => {
      if (!parametros?.id) throw new Error('Parâmetros não encontrados');
      await updateParametros(parametros.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parametros-djen', tipoAtual?.id] });
      setLocalParams(null);
      setIsDirty(false);
      toast.success('Parâmetros atualizados com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tipoAtual?.id) throw new Error('Tipo não selecionado');
      await createParametros(tipoAtual.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parametros-djen', tipoAtual?.id] });
      toast.success('Configuração criada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao criar configuração: ${error.message}`);
    },
  });

  const currentParams = localParams ? { ...parametros, ...localParams } : parametros;
  const isProcessos = tipoAtual?.slug === 'djen_processos';

  const handleChange = (field: keyof ParametrosDjen, value: any) => {
    setIsDirty(true);
    setLocalParams(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (localParams) {
      updateMutation.mutate(localParams);
    } else {
      toast.info('Nenhuma alteração para salvar.');
    }
  };

  const handleReset = () => {
    setLocalParams(DEFAULTS);
    setIsDirty(true);
    toast.info('Valores padrão carregados. Clique em Salvar para aplicar.');
  };

  const handleApplyPreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    updateMutation.mutate(preset);
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
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhuma configuração encontrada para o tipo selecionado.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={tipoAtual?.id}
                onValueChange={(v) => setTipoSelecionado(v)}
              >
                <SelectTrigger className="h-8 w-[220px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {(tipos || []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={!tipoAtual?.id || createMutation.isPending}
              >
                Criar configuração
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasChanges = isDirty;

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
                <Select
                  value={tipoAtual?.id}
                  onValueChange={(v) => setTipoSelecionado(v)}
                >
                  <SelectTrigger className="h-8 w-[200px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(tipos || []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            {/* Presets rápidos */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Presets rápidos</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyPreset('conservador')}
                >
                  🛡️ Conservador
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyPreset('equilibrado')}
                >
                  ⚖️ Equilibrado
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyPreset('turbo')}
                >
                  ⚡ Turbo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Presets aplicam imediatamente. Se houver rate limit, use o Conservador.
              </p>
            </div>

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

            {isProcessos && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Parâmetros DJEN Processos</Label>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Batch size</Label>
                    <Input
                      type="number"
                      value={currentParams?.batch_size || 50}
                      onChange={(e) => handleChange('batch_size', parseInt(e.target.value))}
                      min={1}
                      max={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Group search size</Label>
                    <Input
                      type="number"
                      value={currentParams?.group_search_size || 50}
                      onChange={(e) => handleChange('group_search_size', parseInt(e.target.value))}
                      min={1}
                      max={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Delay entre lotes</Label>
                    <Input
                      type="number"
                      value={currentParams?.delay_entre_lotes || 3000}
                      onChange={(e) => handleChange('delay_entre_lotes', parseInt(e.target.value))}
                      min={0}
                      max={20000}
                    />
                  </div>
                </div>
              </div>
            )}

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
