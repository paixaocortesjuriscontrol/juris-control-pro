import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMonitoramentosDjen, MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Info, Bell } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

// Tribunais disponíveis para busca específica
const TRIBUNAIS_DISPONIVEIS = [
  { id: 'TJDFT', nome: 'TJDFT - Tribunal de Justiça do DF', categoria: 'Estadual' },
  { id: 'TJSP', nome: 'TJSP - Tribunal de Justiça de SP', categoria: 'Estadual' },
  { id: 'TJGO', nome: 'TJGO - Tribunal de Justiça de GO', categoria: 'Estadual' },
  { id: 'TRF1', nome: 'TRF1 - Tribunal Regional Federal 1ª Região', categoria: 'Federal' },
  { id: 'TRF2', nome: 'TRF2 - Tribunal Regional Federal 2ª Região', categoria: 'Federal' },
  { id: 'TRF3', nome: 'TRF3 - Tribunal Regional Federal 3ª Região', categoria: 'Federal' },
  { id: 'TRF4', nome: 'TRF4 - Tribunal Regional Federal 4ª Região', categoria: 'Federal' },
  { id: 'TRF5', nome: 'TRF5 - Tribunal Regional Federal 5ª Região', categoria: 'Federal' },
  { id: 'TRF6', nome: 'TRF6 - Tribunal Regional Federal 6ª Região', categoria: 'Federal' },
  { id: 'STJ', nome: 'STJ - Superior Tribunal de Justiça', categoria: 'Superior' },
  { id: 'STF', nome: 'STF - Supremo Tribunal Federal', categoria: 'Superior' },
  { id: 'TST', nome: 'TST - Tribunal Superior do Trabalho', categoria: 'Trabalhista' },
  { id: 'TRT1', nome: 'TRT1 - Tribunal Regional do Trabalho 1ª Região', categoria: 'Trabalhista' },
  { id: 'TRT2', nome: 'TRT2 - Tribunal Regional do Trabalho 2ª Região', categoria: 'Trabalhista' },
  { id: 'TRT3', nome: 'TRT3 - Tribunal Regional do Trabalho 3ª Região', categoria: 'Trabalhista' },
  { id: 'TRT4', nome: 'TRT4 - Tribunal Regional do Trabalho 4ª Região', categoria: 'Trabalhista' },
  { id: 'TRT5', nome: 'TRT5 - Tribunal Regional do Trabalho 5ª Região', categoria: 'Trabalhista' },
  { id: 'TRT10', nome: 'TRT10 - Tribunal Regional do Trabalho 10ª Região (DF/TO)', categoria: 'Trabalhista' },
  { id: 'TRT18', nome: 'TRT18 - Tribunal Regional do Trabalho 18ª Região (GO)', categoria: 'Trabalhista' },
  { id: 'TODOS_TRT', nome: 'Todos os TRTs (1ª instância + TRTs + TST)', categoria: 'Trabalhista' },
  { id: 'TODOS_CIVEIS', nome: 'Todos os Tribunais Cíveis (TJs)', categoria: 'Estadual' },
];

interface MonitoramentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitoramento?: MonitoramentoDjen | null;
}

export function MonitoramentoDialog({ open, onOpenChange, monitoramento }: MonitoramentoDialogProps) {
  const { criarMonitoramento, atualizarMonitoramento } = useMonitoramentosDjen();
  const { data: coordenacoes = [], isLoading: loadingCoordenacoes } = useCoordenacoesFull();
  const queryClient = useQueryClient();
  
  const [tipo, setTipo] = useState<'palavra-chave' | 'advogado' | 'processo'>(
    monitoramento?.tipo || 'palavra-chave'
  );
  const [termoBusca, setTermoBusca] = useState(monitoramento?.termo_busca || '');
  const [oab, setOab] = useState(monitoramento?.oab || '');
  const [selectedUfs, setSelectedUfs] = useState<string[]>([]);
  const [todasRegioes, setTodasRegioes] = useState(false);
  const [coordenacaoId, setCoordenacaoId] = useState<string>(monitoramento?.coordenacao_id || '');
  
  // Novos campos avançados
  const [descricao, setDescricao] = useState(monitoramento?.descricao || '');
  const [exclusoes, setExclusoes] = useState<string[]>(monitoramento?.exclusoes || []);
  const [novaExclusao, setNovaExclusao] = useState('');
  const [condicaoConcomitante, setCondicaoConcomitante] = useState(monitoramento?.condicao_concomitante || '');
  const [tribunaisSelecionados, setTribunaisSelecionados] = useState<string[]>(monitoramento?.tribunais || []);

  // Estados para aba de alertas
  const [alertaAtivo, setAlertaAtivo] = useState(false);
  const [horarioEnvio, setHorarioEnvio] = useState('08:00');
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);

  // Buscar membros da coordenação selecionada
  const { data: membrosCoordenacao = [] } = useQuery({
    queryKey: ['membros-coordenacao', coordenacaoId],
    queryFn: async () => {
      if (!coordenacaoId) return [];
      const { data, error } = await supabase
        .from('membros_coordenacao')
        .select('usuario_id, profiles:usuario_id(id, nome, telefone)')
        .eq('coordenacao_id', coordenacaoId);
      if (error) throw error;
      return data?.map(m => ({
        id: m.usuario_id,
        nome: (m.profiles as any)?.nome || 'Sem nome',
        telefone: (m.profiles as any)?.telefone || null
      })) || [];
    },
    enabled: !!coordenacaoId,
  });

  // Buscar configuração de alerta existente
  const { data: alertaExistente } = useQuery({
    queryKey: ['alerta-monitoramento-djen', monitoramento?.id],
    queryFn: async () => {
      if (!monitoramento?.id) return null;
      const { data, error } = await supabase
        .from('alertas_monitoramento_djen')
        .select('*')
        .eq('monitoramento_id', monitoramento.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!monitoramento?.id,
  });

  // Carregar configuração de alerta existente
  useEffect(() => {
    if (alertaExistente) {
      setAlertaAtivo(alertaExistente.ativo);
      setHorarioEnvio(alertaExistente.horario_envio?.slice(0, 5) || '08:00');
      setMembrosSelecionados(alertaExistente.membros_ids || []);
    } else {
      setAlertaAtivo(false);
      setHorarioEnvio('08:00');
      setMembrosSelecionados([]);
    }
  }, [alertaExistente]);

  useEffect(() => {
    if (monitoramento) {
      setTipo(monitoramento.tipo as typeof tipo);
      setTermoBusca(monitoramento.termo_busca || '');
      setOab(monitoramento.oab || '');
      setCoordenacaoId(monitoramento.coordenacao_id || '');
      setDescricao(monitoramento.descricao || '');
      setExclusoes(monitoramento.exclusoes || []);
      setCondicaoConcomitante(monitoramento.condicao_concomitante || '');
      setTribunaisSelecionados(monitoramento.tribunais || []);
      
      if (monitoramento.uf) {
        if (monitoramento.uf === 'TODAS') {
          setTodasRegioes(true);
          setSelectedUfs([]);
        } else {
          setTodasRegioes(false);
          setSelectedUfs(monitoramento.uf.split(','));
        }
      }
    } else {
      // Reset para novo monitoramento
      setTipo('palavra-chave');
      setTermoBusca('');
      setOab('');
      setCoordenacaoId('');
      setDescricao('');
      setExclusoes([]);
      setCondicaoConcomitante('');
      setTribunaisSelecionados([]);
      setSelectedUfs([]);
      setTodasRegioes(false);
      setAlertaAtivo(false);
      setHorarioEnvio('08:00');
      setMembrosSelecionados([]);
    }
  }, [monitoramento, open]);

  const handleToggleUf = (uf: string) => {
    setSelectedUfs(prev => 
      prev.includes(uf) 
        ? prev.filter(u => u !== uf)
        : [...prev, uf]
    );
  };

  const handleTodasRegioes = (checked: boolean) => {
    setTodasRegioes(checked);
    if (checked) {
      setSelectedUfs([]);
    }
  };

  const handleAddExclusao = () => {
    if (novaExclusao.trim() && !exclusoes.includes(novaExclusao.trim().toUpperCase())) {
      setExclusoes([...exclusoes, novaExclusao.trim().toUpperCase()]);
      setNovaExclusao('');
    }
  };

  const handleRemoveExclusao = (termo: string) => {
    setExclusoes(exclusoes.filter(e => e !== termo));
  };

  const handleToggleTribunal = (tribunalId: string) => {
    setTribunaisSelecionados(prev =>
      prev.includes(tribunalId)
        ? prev.filter(t => t !== tribunalId)
        : [...prev, tribunalId]
    );
  };

  const handleToggleMembro = (membroId: string) => {
    setMembrosSelecionados(prev =>
      prev.includes(membroId)
        ? prev.filter(id => id !== membroId)
        : [...prev, membroId]
    );
  };

  const salvarAlerta = async (monitoramentoId: string) => {
    if (!alertaAtivo && !alertaExistente) return;

    const alertaData = {
      monitoramento_id: monitoramentoId,
      ativo: alertaAtivo,
      horario_envio: horarioEnvio + ':00',
      membros_ids: membrosSelecionados,
    };

    if (alertaExistente) {
      await supabase
        .from('alertas_monitoramento_djen')
        .update(alertaData)
        .eq('id', alertaExistente.id);
    } else if (alertaAtivo) {
      await supabase
        .from('alertas_monitoramento_djen')
        .insert(alertaData);
    }
    
    queryClient.invalidateQueries({ queryKey: ['alerta-monitoramento-djen'] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const ufValue = tipo === 'advogado' 
      ? (todasRegioes ? 'TODAS' : selectedUfs.join(','))
      : undefined;

    const dados = {
      tipo,
      termo_busca: termoBusca,
      oab: tipo === 'advogado' ? oab : undefined,
      uf: ufValue,
      coordenacao_id: coordenacaoId || undefined,
      descricao: descricao || undefined,
      exclusoes: exclusoes.length > 0 ? exclusoes : undefined,
      condicao_concomitante: condicaoConcomitante || undefined,
      tribunais: tribunaisSelecionados.length > 0 ? tribunaisSelecionados : undefined,
    };

    try {
      if (monitoramento) {
        await atualizarMonitoramento.mutateAsync({ id: monitoramento.id, ...dados });
        await salvarAlerta(monitoramento.id);
      } else {
        const result = await criarMonitoramento.mutateAsync(dados);
        if (result?.id) {
          await salvarAlerta(result.id);
        }
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar monitoramento:', error);
    }
  };

  const isUfValid = tipo !== 'advogado' || todasRegioes || selectedUfs.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {monitoramento ? 'Editar Monitoramento' : 'Novo Monitoramento DJEN'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="filtros">Filtros</TabsTrigger>
              <TabsTrigger value="tribunais">Tribunais</TabsTrigger>
              <TabsTrigger value="alertas" className="flex items-center gap-1">
                <Bell className="h-3 w-3" />
                Alertas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="coordenacao">Coordenação *</Label>
                <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingCoordenacoes ? (
                      <SelectItem value="" disabled>Carregando...</SelectItem>
                    ) : (
                      coordenacoes.map((coord) => (
                        <SelectItem key={coord.id} value={coord.id}>
                          {coord.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Busca</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="palavra-chave">Palavra-chave / Razão Social</SelectItem>
                    <SelectItem value="advogado">Advogado (OAB ou Nome)</SelectItem>
                    <SelectItem value="processo">Número do Processo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipo === 'advogado' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="oab">Número OAB</Label>
                      <Input
                        id="oab"
                        value={oab}
                        onChange={(e) => setOab(e.target.value)}
                        placeholder="Ex: 15553"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="termo">Nome do Advogado *</Label>
                      <Input
                        id="termo"
                        value={termoBusca}
                        onChange={(e) => setTermoBusca(e.target.value)}
                        placeholder="Ex: OSMAR MENDES"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label>Regiões (UFs)</Label>
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox 
                        id="todas-regioes"
                        checked={todasRegioes}
                        onCheckedChange={handleTodasRegioes}
                      />
                      <label htmlFor="todas-regioes" className="text-sm font-medium cursor-pointer">
                        Todas as regiões
                      </label>
                    </div>
                    
                    {!todasRegioes && (
                      <ScrollArea className="h-24 border rounded-md p-2">
                        <div className="grid grid-cols-7 gap-2">
                          {UFS.map((uf) => (
                            <div key={uf} className="flex items-center space-x-1">
                              <Checkbox 
                                id={`uf-${uf}`}
                                checked={selectedUfs.includes(uf)}
                                onCheckedChange={() => handleToggleUf(uf)}
                              />
                              <label htmlFor={`uf-${uf}`} className="text-xs cursor-pointer">
                                {uf}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="termo">
                    {tipo === 'processo' ? 'Número do Processo *' : 'Palavra-chave / Razão Social *'}
                  </Label>
                  <Input
                    id="termo"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    placeholder={tipo === 'processo' 
                      ? 'Ex: 0001234-12.2024.5.10.0001' 
                      : 'Ex: Anovis Industrial Farmacêutica LTDA'}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição (opcional)</Label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descrição detalhada do monitoramento..."
                  rows={2}
                />
              </div>
            </TabsContent>

            <TabsContent value="filtros" className="space-y-4 mt-4">
              {/* Condição concomitante */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="condicao">Condição Concomitante (AND)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Termo adicional que DEVE aparecer junto com o termo de busca. Ex: OAB 15553 + BRADESCO (ambos devem estar na publicação)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="condicao"
                  value={condicaoConcomitante}
                  onChange={(e) => setCondicaoConcomitante(e.target.value)}
                  placeholder="Ex: BRADESCO, SERVIÇO DE APOIO"
                />
              </div>

              {/* Critérios de exclusão */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Critérios de Exclusão</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Publicações contendo estes termos serão enviadas para a aba "Descartadas" ao invés de aparecerem nas publicações principais.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    value={novaExclusao}
                    onChange={(e) => setNovaExclusao(e.target.value)}
                    placeholder="Ex: SANTANDER"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExclusao();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleAddExclusao}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {exclusoes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {exclusoes.map((termo) => (
                      <Badge key={termo} variant="secondary" className="gap-1">
                        {termo}
                        <button
                          type="button"
                          onClick={() => handleRemoveExclusao(termo)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="tribunais" className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Tribunais Específicos</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Se nenhum tribunal for selecionado, a busca será feita em todos os tribunais disponíveis conforme o tipo de busca.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <ScrollArea className="h-64 border rounded-md p-3">
                  {['Superior', 'Federal', 'Estadual', 'Trabalhista'].map((categoria) => (
                    <div key={categoria} className="mb-4">
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground">{categoria}</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {TRIBUNAIS_DISPONIVEIS.filter(t => t.categoria === categoria).map((tribunal) => (
                          <div key={tribunal.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`tribunal-${tribunal.id}`}
                              checked={tribunaisSelecionados.includes(tribunal.id)}
                              onCheckedChange={() => handleToggleTribunal(tribunal.id)}
                            />
                            <label htmlFor={`tribunal-${tribunal.id}`} className="text-sm cursor-pointer">
                              {tribunal.nome}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>

                {tribunaisSelecionados.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tribunaisSelecionados.map((t) => (
                      <Badge key={t} variant="outline">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="alertas" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Alertas WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificações quando novas publicações forem encontradas
                    </p>
                  </div>
                  <Switch
                    checked={alertaAtivo}
                    onCheckedChange={setAlertaAtivo}
                  />
                </div>

                {alertaAtivo && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="horario">Horário de Envio</Label>
                      <Input
                        id="horario"
                        type="time"
                        value={horarioEnvio}
                        onChange={(e) => setHorarioEnvio(e.target.value)}
                        className="w-40"
                      />
                      <p className="text-xs text-muted-foreground">
                        Os alertas serão enviados diariamente neste horário se houver novas publicações
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Membros que receberão alertas</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Selecione os membros da coordenação que receberão alertas via WhatsApp. Apenas membros com telefone cadastrado podem receber alertas.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      {!coordenacaoId ? (
                        <p className="text-sm text-muted-foreground italic">
                          Selecione uma coordenação na aba "Básico" para ver os membros disponíveis
                        </p>
                      ) : membrosCoordenacao.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          Nenhum membro encontrado nesta coordenação
                        </p>
                      ) : (
                        <ScrollArea className="h-48 border rounded-md p-3">
                          <div className="space-y-2">
                            {membrosCoordenacao.map((membro) => (
                              <div key={membro.id} className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50">
                                <Checkbox
                                  id={`membro-${membro.id}`}
                                  checked={membrosSelecionados.includes(membro.id)}
                                  onCheckedChange={() => handleToggleMembro(membro.id)}
                                  disabled={!membro.telefone}
                                />
                                <div className="flex-1">
                                  <label 
                                    htmlFor={`membro-${membro.id}`} 
                                    className={`text-sm cursor-pointer ${!membro.telefone ? 'text-muted-foreground' : ''}`}
                                  >
                                    {membro.nome}
                                  </label>
                                  {membro.telefone ? (
                                    <p className="text-xs text-muted-foreground">{membro.telefone}</p>
                                  ) : (
                                    <p className="text-xs text-destructive">Sem telefone cadastrado</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}

                      {membrosSelecionados.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {membrosSelecionados.map((id) => {
                            const membro = membrosCoordenacao.find(m => m.id === id);
                            return membro ? (
                              <Badge key={id} variant="secondary" className="gap-1">
                                {membro.nome}
                                <button
                                  type="button"
                                  onClick={() => handleToggleMembro(id)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={criarMonitoramento.isPending || atualizarMonitoramento.isPending || !isUfValid || !coordenacaoId || !termoBusca}
            >
              {monitoramento ? 'Salvar' : 'Criar Monitoramento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}