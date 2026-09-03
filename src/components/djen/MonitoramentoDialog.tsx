import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useMonitoramentosDjen, MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeTribunais } from "@/utils/djenTribunais";

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

// Tribunais disponíveis para busca específica - TODOS OS 27 TJs + Federais + Trabalhistas
const TRIBUNAIS_DISPONIVEIS = [
  // Estadual (TJs) - TODOS OS 27 ESTADOS em ordem alfabética
  { id: 'TJAC', nome: 'TJAC - Tribunal de Justiça do Acre', categoria: 'Estadual' },
  { id: 'TJAL', nome: 'TJAL - Tribunal de Justiça de Alagoas', categoria: 'Estadual' },
  { id: 'TJAM', nome: 'TJAM - Tribunal de Justiça do Amazonas', categoria: 'Estadual' },
  { id: 'TJAP', nome: 'TJAP - Tribunal de Justiça do Amapá', categoria: 'Estadual' },
  { id: 'TJBA', nome: 'TJBA - Tribunal de Justiça da Bahia', categoria: 'Estadual' },
  { id: 'TJCE', nome: 'TJCE - Tribunal de Justiça do Ceará', categoria: 'Estadual' },
  { id: 'TJDFT', nome: 'TJDFT - Tribunal de Justiça do DF', categoria: 'Estadual' },
  { id: 'TJES', nome: 'TJES - Tribunal de Justiça do Espírito Santo', categoria: 'Estadual' },
  { id: 'TJGO', nome: 'TJGO - Tribunal de Justiça de Goiás', categoria: 'Estadual' },
  { id: 'TJMA', nome: 'TJMA - Tribunal de Justiça do Maranhão', categoria: 'Estadual' },
  { id: 'TJMG', nome: 'TJMG - Tribunal de Justiça de Minas Gerais', categoria: 'Estadual' },
  { id: 'TJMS', nome: 'TJMS - Tribunal de Justiça de Mato Grosso do Sul', categoria: 'Estadual' },
  { id: 'TJMT', nome: 'TJMT - Tribunal de Justiça de Mato Grosso', categoria: 'Estadual' },
  { id: 'TJPA', nome: 'TJPA - Tribunal de Justiça do Pará', categoria: 'Estadual' },
  { id: 'TJPB', nome: 'TJPB - Tribunal de Justiça da Paraíba', categoria: 'Estadual' },
  { id: 'TJPE', nome: 'TJPE - Tribunal de Justiça de Pernambuco', categoria: 'Estadual' },
  { id: 'TJPI', nome: 'TJPI - Tribunal de Justiça do Piauí', categoria: 'Estadual' },
  { id: 'TJPR', nome: 'TJPR - Tribunal de Justiça do Paraná', categoria: 'Estadual' },
  { id: 'TJRJ', nome: 'TJRJ - Tribunal de Justiça do Rio de Janeiro', categoria: 'Estadual' },
  { id: 'TJRN', nome: 'TJRN - Tribunal de Justiça do Rio Grande do Norte', categoria: 'Estadual' },
  { id: 'TJRO', nome: 'TJRO - Tribunal de Justiça de Rondônia', categoria: 'Estadual' },
  { id: 'TJRR', nome: 'TJRR - Tribunal de Justiça de Roraima', categoria: 'Estadual' },
  { id: 'TJRS', nome: 'TJRS - Tribunal de Justiça do Rio Grande do Sul', categoria: 'Estadual' },
  { id: 'TJSC', nome: 'TJSC - Tribunal de Justiça de Santa Catarina', categoria: 'Estadual' },
  { id: 'TJSE', nome: 'TJSE - Tribunal de Justiça de Sergipe', categoria: 'Estadual' },
  { id: 'TJSP', nome: 'TJSP - Tribunal de Justiça de São Paulo', categoria: 'Estadual' },
  { id: 'TJTO', nome: 'TJTO - Tribunal de Justiça de Tocantins', categoria: 'Estadual' },
  { id: 'TODOS_CIVEIS', nome: 'Todos os Tribunais Cíveis (27 TJs)', categoria: 'Estadual' },
  // Federal (TRFs)
  { id: 'TRF1', nome: 'TRF1 - Tribunal Regional Federal 1ª Região', categoria: 'Federal' },
  { id: 'TRF2', nome: 'TRF2 - Tribunal Regional Federal 2ª Região', categoria: 'Federal' },
  { id: 'TRF3', nome: 'TRF3 - Tribunal Regional Federal 3ª Região', categoria: 'Federal' },
  { id: 'TRF4', nome: 'TRF4 - Tribunal Regional Federal 4ª Região', categoria: 'Federal' },
  { id: 'TRF5', nome: 'TRF5 - Tribunal Regional Federal 5ª Região', categoria: 'Federal' },
  { id: 'TRF6', nome: 'TRF6 - Tribunal Regional Federal 6ª Região', categoria: 'Federal' },
  // Superior
  { id: 'STJ', nome: 'STJ - Superior Tribunal de Justiça', categoria: 'Superior' },
  { id: 'STF', nome: 'STF - Supremo Tribunal Federal', categoria: 'Superior' },
  // Trabalhista
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
];

// Listas de IDs reais para seleção em lote
const TODOS_IDS_CIVEIS = TRIBUNAIS_DISPONIVEIS
  .filter(t => t.categoria === 'Estadual' && t.id !== 'TODOS_CIVEIS')
  .map(t => t.id);

const TODOS_IDS_TRABALHISTAS = TRIBUNAIS_DISPONIVEIS
  .filter(t => t.categoria === 'Trabalhista' && t.id !== 'TODOS_TRT')
  .map(t => t.id);

interface MonitoramentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitoramento?: MonitoramentoDjen | null;
  /** Quando fornecido, pré-preenche o formulário como NOVO monitoramento (duplicação) */
  duplicateFrom?: MonitoramentoDjen | null;
  /** Quando fornecido, substitui a lista completa de coordenações (para filtrar por usuário) */
  coordenacoesOverride?: { id: string; nome: string; area?: string }[];
}

export function MonitoramentoDialog({ open, onOpenChange, monitoramento, duplicateFrom, coordenacoesOverride }: MonitoramentoDialogProps) {
  // Fonte para pré-preenchimento: edição usa monitoramento; duplicação usa duplicateFrom
  const fonte = monitoramento ?? duplicateFrom ?? null;
  const { criarMonitoramento, criarMonitoramentosEmLote, atualizarMonitoramento } = useMonitoramentosDjen();
  const { data: coordenacoesAll = [], isLoading: loadingCoordenacoes } = useCoordenacoesFull();
  const coordenacoes = coordenacoesOverride ?? coordenacoesAll;
  
  const [tipo, setTipo] = useState<'palavra-chave' | 'advogado' | 'processo' | 'parte' | 'geral'>(
    (fonte?.tipo as any) || 'palavra-chave'
  );
  const [termoBusca, setTermoBusca] = useState(fonte?.termo_busca || '');
  const [oab, setOab] = useState(fonte?.oab || '');
  const [somenteKurier, setSomenteKurier] = useState<boolean>(!!(fonte as any)?.somente_kurier);
  const [buscaStfAtiva, setBuscaStfAtiva] = useState<boolean>(!!(fonte as any)?.busca_stf_ativa);
  const [selectedUfs, setSelectedUfs] = useState<string[]>([]);
  const [todasRegioes, setTodasRegioes] = useState(false);
  const [coordenacaoId, setCoordenacaoId] = useState<string>(fonte?.coordenacao_id || '');
  
  // Novos campos avançados
  const [descricao, setDescricao] = useState(fonte?.descricao || '');
  const [exclusoes, setExclusoes] = useState<string[]>(fonte?.exclusoes || []);
  const [novaExclusao, setNovaExclusao] = useState('');
  const [condicoesConcomitantes, setCondicoesConcomitantes] = useState<string[]>(
    fonte?.condicao_concomitante?.split('|').map(s => s.trim()).filter(Boolean) || []
  );
  const [novaCondicao, setNovaCondicao] = useState('');
  const [termosOr, setTermosOr] = useState<string[]>(fonte?.termos_or || []);
  const [novoTermoOr, setNovoTermoOr] = useState('');
  const [tribunaisSelecionados, setTribunaisSelecionados] = useState<string[]>(
    normalizeTribunais(fonte?.tribunais) ?? []
  );
  const [criarTermosOrSeparados, setCriarTermosOrSeparados] = useState(false);

  useEffect(() => {
    const src = monitoramento ?? duplicateFrom ?? null;
    if (src) {
      setTipo(src.tipo as typeof tipo);
      setTermoBusca(src.termo_busca || '');
      setOab(src.oab || '');
      setSomenteKurier(!!(src as any).somente_kurier);
      setBuscaStfAtiva(!!(src as any).busca_stf_ativa);
      setCoordenacaoId(src.coordenacao_id || '');
      // Em duplicação, sufixar a descrição para o usuário identificar
      const baseDesc = src.descricao || '';
      setDescricao(duplicateFrom && !monitoramento ? `${baseDesc} (cópia)`.trim() : baseDesc);
      setExclusoes(src.exclusoes || []);
      setCondicoesConcomitantes(
        src.condicao_concomitante?.split('|').map(s => s.trim()).filter(Boolean) || []
      );
      setNovaCondicao('');
      setTermosOr(src.termos_or || []);
      // Duplicar deve criar apenas UMA cópia. Quebrar em vários monitoramentos
      // é opt-in pelo checkbox "Criar termos OR separados".
      setCriarTermosOrSeparados(false);
      
      // Expandir IDs sintéticos ao carregar
      const tribunaisCarregados = normalizeTribunais(src.tribunais) ?? [];
      const expandidos: string[] = [];
      for (const t of tribunaisCarregados) {
        if (t === 'TODOS_TRT') {
          expandidos.push(...TODOS_IDS_TRABALHISTAS);
        } else if (t === 'TODOS_CIVEIS') {
          expandidos.push(...TODOS_IDS_CIVEIS);
        } else {
          expandidos.push(t);
        }
      }
      setTribunaisSelecionados(normalizeTribunais(expandidos) ?? []);
      
      if (src.uf) {
        if (src.uf === 'TODAS') {
          setTodasRegioes(true);
          setSelectedUfs([]);
        } else {
          setTodasRegioes(false);
          setSelectedUfs(src.uf.split(',').map(s => s.trim()).filter(Boolean));
        }
      } else {
        setTodasRegioes(false);
        setSelectedUfs([]);
      }
    } else {
      // Reset para novo monitoramento
      setTipo('palavra-chave');
      setTermoBusca('');
      setOab('');
      setSomenteKurier(false);
      setCoordenacaoId('');
      setDescricao('');
      setExclusoes([]);
      setCondicoesConcomitantes([]);
      setNovaCondicao('');
      setTermosOr([]);
      setCriarTermosOrSeparados(false);
      setTribunaisSelecionados([]);
      setSelectedUfs([]);
      setTodasRegioes(false);
    }
  }, [monitoramento, duplicateFrom, open]);

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

  const handleAddTermoOr = () => {
    const val = novoTermoOr.trim().toUpperCase();
    if (val && !termosOr.includes(val)) {
      setTermosOr([...termosOr, val]);
      setNovoTermoOr('');
    }
  };

  const handleRemoveTermoOr = (termo: string) => {
    setTermosOr(termosOr.filter(t => t !== termo));
  };

  const handleAddCondicao = () => {
    const val = novaCondicao.trim().toUpperCase();
    if (val && !condicoesConcomitantes.includes(val)) {
      setCondicoesConcomitantes([...condicoesConcomitantes, val]);
      setNovaCondicao('');
    }
  };

  const handleRemoveCondicao = (termo: string) => {
    setCondicoesConcomitantes(condicoesConcomitantes.filter(c => c !== termo));
  };

  const handleToggleTribunal = (tribunalId: string) => {
    // Caso especial: "Todos os TRTs"
    if (tribunalId === 'TODOS_TRT') {
      const todosMarcados = TODOS_IDS_TRABALHISTAS.every(id => 
        tribunaisSelecionados.includes(id)
      );
      if (todosMarcados) {
        // Desmarcar todos
        setTribunaisSelecionados(prev => 
          prev.filter(t => !TODOS_IDS_TRABALHISTAS.includes(t))
        );
      } else {
        // Marcar todos
        setTribunaisSelecionados(prev => 
          [...new Set([...prev, ...TODOS_IDS_TRABALHISTAS])]
        );
      }
      return;
    }
    
    // Caso especial: "Todos os Cíveis"
    if (tribunalId === 'TODOS_CIVEIS') {
      const todosMarcados = TODOS_IDS_CIVEIS.every(id => 
        tribunaisSelecionados.includes(id)
      );
      if (todosMarcados) {
        // Desmarcar todos
        setTribunaisSelecionados(prev => 
          prev.filter(t => !TODOS_IDS_CIVEIS.includes(t))
        );
      } else {
        // Marcar todos
        setTribunaisSelecionados(prev => 
          [...new Set([...prev, ...TODOS_IDS_CIVEIS])]
        );
      }
      return;
    }
    
    // Comportamento padrão para tribunais individuais
    setTribunaisSelecionados(prev =>
      prev.includes(tribunalId)
        ? prev.filter(t => t !== tribunalId)
        : [...prev, tribunalId]
    );
  };

  // Calcular estado dos checkboxes "Todos"
  const todosTrabalhistasMarcados = TODOS_IDS_TRABALHISTAS.every(id => 
    tribunaisSelecionados.includes(id)
  );
  const algunsTrabalhistasMarcados = TODOS_IDS_TRABALHISTAS.some(id => 
    tribunaisSelecionados.includes(id)
  );
  const todosCiveisMarcados = TODOS_IDS_CIVEIS.every(id => 
    tribunaisSelecionados.includes(id)
  );
  const algunsCiveisMarcados = TODOS_IDS_CIVEIS.some(id => 
    tribunaisSelecionados.includes(id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const ufValue = tipo === 'advogado' 
      ? (todasRegioes ? 'TODAS' : selectedUfs.join(','))
      : undefined;

    // IMPORTANTE: NÃO mesclar `condicoesConcomitantes` em `termos_or`.
    // Os engines (DJEN Termos Paralela, DJET Pautas) já leem
    // `condicao_concomitante` de forma independente. Mesclar fazia com que
    // o chip da AND fosse gravado também na coluna OR no banco, e ao reabrir
    // o diálogo o item removido da OR voltava (bug: remover chip não persiste).
    const termosOrFinal = Array.from(
      new Set(termosOr.map((t) => (t || '').trim()).filter(Boolean)),
    );

    const dados = {
      tipo,
      termo_busca: termoBusca,
      oab: tipo === 'advogado' ? oab : undefined,
      uf: ufValue,
      coordenacao_id: coordenacaoId || undefined,
      somente_kurier: somenteKurier,
      busca_stf_ativa: buscaStfAtiva,
      descricao: descricao || undefined,
      exclusoes: exclusoes.length > 0 ? exclusoes : undefined,
      condicao_concomitante: condicoesConcomitantes.length > 0 ? condicoesConcomitantes.join(' | ') : undefined,
      termos_or: termosOrFinal.length > 0 ? termosOrFinal : undefined,
      // IMPORTANT: ao limpar seleção, precisamos atualizar o campo no DB (undefined não atualiza)
      tribunais: tribunaisSelecionados.length > 0 ? normalizeTribunais(tribunaisSelecionados) : null,
    };

    if (monitoramento) {
      await atualizarMonitoramento.mutateAsync({ id: monitoramento.id, ...dados });
    } else if (criarTermosOrSeparados && tipo !== 'advogado' && termosOr.length > 0) {
      const termosSeparados = Array.from(new Set([termoBusca, ...termosOr].map((t) => t.trim()).filter(Boolean)));
      await criarMonitoramentosEmLote.mutateAsync(
        termosSeparados.map((termo) => ({
          ...dados,
          tipo: 'parte' as const,
          termo_busca: termo,
          descricao: descricao ? `${descricao} - ${termo}` : `PARTE - ${termo}`,
          condicao_concomitante: undefined,
          termos_or: undefined,
        }))
      );
    } else {
      await criarMonitoramento.mutateAsync(dados);
    }
    
    onOpenChange(false);
  };

  const isUfValid = tipo !== 'advogado' || todasRegioes || selectedUfs.length > 0;
  
  // Em modo de edição, não exigir coordenação se o monitoramento original não tinha
  // Em modo de criação, continuar exigindo coordenação
  const isFormValid = termoBusca.trim().length > 0 && isUfValid && (monitoramento ? true : !!coordenacaoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
              {monitoramento
              ? 'Editar Monitoramento'
              : duplicateFrom
                ? 'Duplicar Monitoramento DJEN'
                : 'Novo Monitoramento DJEN'}
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
                    <SelectItem value="parte">Polo passivo ou ativo</SelectItem>
                    <SelectItem value="geral">Busca Geral (partes, advogados, conteúdo e processo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                <Switch
                  id="somente-kurier"
                  checked={somenteKurier}
                  onCheckedChange={setSomenteKurier}
                />
                <label htmlFor="somente-kurier" className="cursor-pointer space-y-1 text-sm leading-none">
                  <span className="font-medium">Termo somente para Kurier</span>
                  <span className="block text-xs text-muted-foreground">
                    Quando ativo, este termo só será usado na busca via Kurier. Não será aplicado nas demais buscas DJEN (PJE Comunica, paralela, STF, etc.).
                  </span>
                </label>
              </div>

              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                <Switch
                  id="busca-stf-ativa"
                  checked={buscaStfAtiva}
                  onCheckedChange={setBuscaStfAtiva}
                />
                <label htmlFor="busca-stf-ativa" className="cursor-pointer space-y-1 text-sm leading-none">
                  <span className="font-medium">Também buscar no STF</span>
                  <span className="block text-xs text-muted-foreground">
                    Quando ativo, o motor <strong>STF Servidor</strong> consulta o portal DJE-STF (digital.stf.jus.br) com este termo, nos horários configurados na tela do DJEN Servidor. O STF não publica no DJEN/PJe Comunica — é uma busca separada.
                  </span>
                </label>
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
              ) : tipo === 'parte' ? (
                <div className="space-y-2">
                  <Label htmlFor="termo">Nome da Parte (Polo Ativo/Passivo) *</Label>
                  <Input
                    id="termo"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    placeholder="Ex: UNIAO QUIMICA FARMACEUTICA NACIONAL S A"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Busca publicações onde este nome aparece como parte no processo (reclamante/reclamado).
                    Busca exata, sem variantes.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="termo">
                    {tipo === 'processo'
                      ? 'Número do Processo *'
                      : tipo === 'geral'
                        ? 'Termo (busca em partes, advogados, conteúdo e nº processo) *'
                        : 'Palavra-chave / Razão Social *'}
                  </Label>
                  <Input
                    id="termo"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    placeholder={tipo === 'processo'
                      ? 'Ex: 0001234-12.2024.5.10.0001'
                      : tipo === 'geral'
                        ? 'Ex: HEINZ — casa em qualquer campo'
                        : 'Ex: Anovis Industrial Farmacêutica LTDA'}
                    required
                  />
                  {tipo === 'geral' && (
                    <p className="text-xs text-muted-foreground">
                      Busca ampla: o termo é aceito se aparecer em <strong>qualquer</strong> campo
                      da publicação — partes, advogados, conteúdo ou número do processo. Use quando
                      não souber em qual campo o termo aparece.
                    </p>
                  )}
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
              {/* Palavras/OAB com OR */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>{tipo === 'advogado' ? 'OAB/Advogado (OR)' : 'Palavras-chave (OR)'}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {tipo === 'advogado' ? (
                          <p>Adicione várias OABs ou nomes de advogados. Qualquer um pode aparecer no texto (lógica OR).</p>
                        ) : (
                          <p>Qualquer uma dessas palavras/frases pode aparecer no texto (lógica OR). Útil para combinar com Advogado/OAB.</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={novoTermoOr}
                    onChange={(e) => setNovoTermoOr(e.target.value)}
                    placeholder={tipo === 'advogado' ? 'Ex: RS023805 ou Maria Silva' : 'Ex: SERVIÇO DE APOIO'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTermoOr();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleAddTermoOr}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {termosOr.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {termosOr.map((termo) => (
                      <Badge key={termo} variant="secondary" className="gap-1">
                        {termo}
                        <button
                          type="button"
                          onClick={() => handleRemoveTermoOr(termo)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {tipo !== 'advogado' && termosOr.length > 0 && (
                  <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
                    <Checkbox
                      id="criar-termos-or-separados"
                      checked={criarTermosOrSeparados}
                      onCheckedChange={(checked) => setCriarTermosOrSeparados(Boolean(checked))}
                    />
                    <label htmlFor="criar-termos-or-separados" className="cursor-pointer space-y-1 text-sm leading-none">
                      <span className="flex items-center gap-2 font-medium">
                        <Plus className="h-4 w-4" />
                        Criar cada palavra-chave como novo termo por polo passivo ou ativo
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Gera um monitoramento separado do tipo parte para o termo principal e cada item acima.
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Condição concomitante */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Condição Concomitante (AND)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Cada condição é um critério OR entre si. A publicação deve conter o termo principal E pelo menos uma das condições. Para AND dentro de uma condição, use vírgula (ex: "BRADESCO, SERVIÇO DE APOIO").</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={novaCondicao}
                    onChange={(e) => setNovaCondicao(e.target.value)}
                    placeholder="Ex: GOL ou BRADESCO, SERVIÇO DE APOIO"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCondicao();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleAddCondicao}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {condicoesConcomitantes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {condicoesConcomitantes.map((termo) => (
                      <Badge key={termo} variant="secondary" className="gap-1">
                        {termo}
                        <button
                          type="button"
                          onClick={() => handleRemoveCondicao(termo)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
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
                        {TRIBUNAIS_DISPONIVEIS.filter(t => t.categoria === categoria).map((tribunal) => {
                          // Determinar estado do checkbox para opções "Todos"
                          let isChecked = tribunaisSelecionados.includes(tribunal.id);
                          let isIndeterminate = false;
                          
                          if (tribunal.id === 'TODOS_TRT') {
                            isChecked = todosTrabalhistasMarcados;
                            isIndeterminate = algunsTrabalhistasMarcados && !todosTrabalhistasMarcados;
                          } else if (tribunal.id === 'TODOS_CIVEIS') {
                            isChecked = todosCiveisMarcados;
                            isIndeterminate = algunsCiveisMarcados && !todosCiveisMarcados;
                          }
                          
                          return (
                            <div key={tribunal.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`tribunal-${tribunal.id}`}
                                checked={isIndeterminate ? 'indeterminate' : isChecked}
                                onCheckedChange={() => handleToggleTribunal(tribunal.id)}
                              />
                              <label htmlFor={`tribunal-${tribunal.id}`} className="text-sm cursor-pointer">
                                {tribunal.nome}
                              </label>
                            </div>
                          );
                        })}
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
              disabled={criarMonitoramento.isPending || atualizarMonitoramento.isPending || !isFormValid}
            >
              {monitoramento ? 'Salvar' : 'Criar Monitoramento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}