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
import { X, Plus, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  { id: 'TRT1', nome: 'TRT1 - Rio de Janeiro', categoria: 'Trabalhista' },
  { id: 'TRT2', nome: 'TRT2 - São Paulo', categoria: 'Trabalhista' },
  { id: 'TRT3', nome: 'TRT3 - Minas Gerais', categoria: 'Trabalhista' },
  { id: 'TRT4', nome: 'TRT4 - Rio Grande do Sul', categoria: 'Trabalhista' },
  { id: 'TRT5', nome: 'TRT5 - Bahia', categoria: 'Trabalhista' },
  { id: 'TRT6', nome: 'TRT6 - Pernambuco', categoria: 'Trabalhista' },
  { id: 'TRT7', nome: 'TRT7 - Ceará', categoria: 'Trabalhista' },
  { id: 'TRT8', nome: 'TRT8 - Pará/Amapá', categoria: 'Trabalhista' },
  { id: 'TRT9', nome: 'TRT9 - Paraná', categoria: 'Trabalhista' },
  { id: 'TRT10', nome: 'TRT10 - DF/Tocantins', categoria: 'Trabalhista' },
  { id: 'TRT11', nome: 'TRT11 - Amazonas/Roraima', categoria: 'Trabalhista' },
  { id: 'TRT12', nome: 'TRT12 - Santa Catarina', categoria: 'Trabalhista' },
  { id: 'TRT13', nome: 'TRT13 - Paraíba', categoria: 'Trabalhista' },
  { id: 'TRT14', nome: 'TRT14 - Rondônia/Acre', categoria: 'Trabalhista' },
  { id: 'TRT15', nome: 'TRT15 - Campinas', categoria: 'Trabalhista' },
  { id: 'TRT16', nome: 'TRT16 - Maranhão', categoria: 'Trabalhista' },
  { id: 'TRT17', nome: 'TRT17 - Espírito Santo', categoria: 'Trabalhista' },
  { id: 'TRT18', nome: 'TRT18 - Goiás', categoria: 'Trabalhista' },
  { id: 'TRT19', nome: 'TRT19 - Alagoas', categoria: 'Trabalhista' },
  { id: 'TRT20', nome: 'TRT20 - Sergipe', categoria: 'Trabalhista' },
  { id: 'TRT21', nome: 'TRT21 - Rio Grande do Norte', categoria: 'Trabalhista' },
  { id: 'TRT22', nome: 'TRT22 - Piauí', categoria: 'Trabalhista' },
  { id: 'TRT23', nome: 'TRT23 - Mato Grosso', categoria: 'Trabalhista' },
  { id: 'TRT24', nome: 'TRT24 - Mato Grosso do Sul', categoria: 'Trabalhista' },
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

    if (monitoramento) {
      await atualizarMonitoramento.mutateAsync({ id: monitoramento.id, ...dados });
    } else {
      await criarMonitoramento.mutateAsync(dados);
    }
    
    onOpenChange(false);
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="filtros">Filtros</TabsTrigger>
              <TabsTrigger value="tribunais">Tribunais</TabsTrigger>
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
                      <SelectItem value="__loading__" disabled>Carregando...</SelectItem>
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