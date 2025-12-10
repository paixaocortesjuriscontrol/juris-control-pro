import { useState } from "react";
import { Search, Globe, FileSearch, Loader2, ExternalLink, CheckCircle, Calendar, Filter } from "lucide-react";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Tribunais organizados por categoria
const tribunaisOpcoes = [
  { value: "auto", label: "Auto-detectar pelo número do processo" },
  { value: "stf", label: "STF - Supremo Tribunal Federal" },
  { value: "stj", label: "STJ - Superior Tribunal de Justiça" },
  { value: "tst", label: "TST - Tribunal Superior do Trabalho" },
  { value: "trf1", label: "TRF1 - Tribunal Regional Federal 1ª Região" },
  { value: "trf2", label: "TRF2 - Tribunal Regional Federal 2ª Região" },
  { value: "trf3", label: "TRF3 - Tribunal Regional Federal 3ª Região" },
  { value: "trf4", label: "TRF4 - Tribunal Regional Federal 4ª Região" },
  { value: "trf5", label: "TRF5 - Tribunal Regional Federal 5ª Região" },
  { value: "trf6", label: "TRF6 - Tribunal Regional Federal 6ª Região" },
  { value: "tjsp", label: "TJSP - Tribunal de Justiça de São Paulo" },
  { value: "tjrj", label: "TJRJ - Tribunal de Justiça do Rio de Janeiro" },
  { value: "tjmg", label: "TJMG - Tribunal de Justiça de Minas Gerais" },
  { value: "tjdft", label: "TJDFT - Tribunal de Justiça do DF e Territórios" },
  { value: "tjgo", label: "TJGO - Tribunal de Justiça de Goiás" },
  { value: "tjba", label: "TJBA - Tribunal de Justiça da Bahia" },
  { value: "tjpr", label: "TJPR - Tribunal de Justiça do Paraná" },
  { value: "tjrs", label: "TJRS - Tribunal de Justiça do Rio Grande do Sul" },
  { value: "tjsc", label: "TJSC - Tribunal de Justiça de Santa Catarina" },
  { value: "tjpe", label: "TJPE - Tribunal de Justiça de Pernambuco" },
  { value: "tjce", label: "TJCE - Tribunal de Justiça do Ceará" },
  { value: "tjal", label: "TJAL - Tribunal de Justiça de Alagoas" },
  { value: "tjam", label: "TJAM - Tribunal de Justiça do Amazonas" },
  { value: "tjap", label: "TJAP - Tribunal de Justiça do Amapá" },
  { value: "tjes", label: "TJES - Tribunal de Justiça do Espírito Santo" },
  { value: "tjma", label: "TJMA - Tribunal de Justiça do Maranhão" },
  { value: "tjms", label: "TJMS - Tribunal de Justiça do Mato Grosso do Sul" },
  { value: "tjmt", label: "TJMT - Tribunal de Justiça do Mato Grosso" },
  { value: "tjpa", label: "TJPA - Tribunal de Justiça do Pará" },
  { value: "tjpb", label: "TJPB - Tribunal de Justiça da Paraíba" },
  { value: "tjpi", label: "TJPI - Tribunal de Justiça do Piauí" },
  { value: "tjrn", label: "TJRN - Tribunal de Justiça do Rio Grande do Norte" },
  { value: "tjro", label: "TJRO - Tribunal de Justiça de Rondônia" },
  { value: "tjrr", label: "TJRR - Tribunal de Justiça de Roraima" },
  { value: "tjse", label: "TJSE - Tribunal de Justiça de Sergipe" },
  { value: "tjto", label: "TJTO - Tribunal de Justiça do Tocantins" },
  { value: "trt1", label: "TRT1 - Tribunal Regional do Trabalho 1ª Região (RJ)" },
  { value: "trt2", label: "TRT2 - Tribunal Regional do Trabalho 2ª Região (SP)" },
  { value: "trt3", label: "TRT3 - Tribunal Regional do Trabalho 3ª Região (MG)" },
  { value: "trt4", label: "TRT4 - Tribunal Regional do Trabalho 4ª Região (RS)" },
  { value: "trt5", label: "TRT5 - Tribunal Regional do Trabalho 5ª Região (BA)" },
  { value: "trt6", label: "TRT6 - Tribunal Regional do Trabalho 6ª Região (PE)" },
  { value: "trt7", label: "TRT7 - Tribunal Regional do Trabalho 7ª Região (CE)" },
  { value: "trt8", label: "TRT8 - Tribunal Regional do Trabalho 8ª Região (PA/AP)" },
  { value: "trt9", label: "TRT9 - Tribunal Regional do Trabalho 9ª Região (PR)" },
  { value: "trt10", label: "TRT10 - Tribunal Regional do Trabalho 10ª Região (DF/TO)" },
  { value: "trt11", label: "TRT11 - Tribunal Regional do Trabalho 11ª Região (AM/RR)" },
  { value: "trt12", label: "TRT12 - Tribunal Regional do Trabalho 12ª Região (SC)" },
  { value: "trt13", label: "TRT13 - Tribunal Regional do Trabalho 13ª Região (PB)" },
  { value: "trt14", label: "TRT14 - Tribunal Regional do Trabalho 14ª Região (RO/AC)" },
  { value: "trt15", label: "TRT15 - Tribunal Regional do Trabalho 15ª Região (Campinas)" },
  { value: "trt16", label: "TRT16 - Tribunal Regional do Trabalho 16ª Região (MA)" },
  { value: "trt17", label: "TRT17 - Tribunal Regional do Trabalho 17ª Região (ES)" },
  { value: "trt18", label: "TRT18 - Tribunal Regional do Trabalho 18ª Região (GO)" },
  { value: "trt19", label: "TRT19 - Tribunal Regional do Trabalho 19ª Região (AL)" },
  { value: "trt20", label: "TRT20 - Tribunal Regional do Trabalho 20ª Região (SE)" },
  { value: "trt21", label: "TRT21 - Tribunal Regional do Trabalho 21ª Região (RN)" },
  { value: "trt22", label: "TRT22 - Tribunal Regional do Trabalho 22ª Região (PI)" },
  { value: "trt23", label: "TRT23 - Tribunal Regional do Trabalho 23ª Região (MT)" },
  { value: "trt24", label: "TRT24 - Tribunal Regional do Trabalho 24ª Região (MS)" },
];

const ufOpcoes = [
  { value: "AC", label: "AC - Acre" },
  { value: "AL", label: "AL - Alagoas" },
  { value: "AP", label: "AP - Amapá" },
  { value: "AM", label: "AM - Amazonas" },
  { value: "BA", label: "BA - Bahia" },
  { value: "CE", label: "CE - Ceará" },
  { value: "DF", label: "DF - Distrito Federal" },
  { value: "ES", label: "ES - Espírito Santo" },
  { value: "GO", label: "GO - Goiás" },
  { value: "MA", label: "MA - Maranhão" },
  { value: "MT", label: "MT - Mato Grosso" },
  { value: "MS", label: "MS - Mato Grosso do Sul" },
  { value: "MG", label: "MG - Minas Gerais" },
  { value: "PA", label: "PA - Pará" },
  { value: "PB", label: "PB - Paraíba" },
  { value: "PR", label: "PR - Paraná" },
  { value: "PE", label: "PE - Pernambuco" },
  { value: "PI", label: "PI - Piauí" },
  { value: "RJ", label: "RJ - Rio de Janeiro" },
  { value: "RN", label: "RN - Rio Grande do Norte" },
  { value: "RS", label: "RS - Rio Grande do Sul" },
  { value: "RO", label: "RO - Rondônia" },
  { value: "RR", label: "RR - Roraima" },
  { value: "SC", label: "SC - Santa Catarina" },
  { value: "SP", label: "SP - São Paulo" },
  { value: "SE", label: "SE - Sergipe" },
  { value: "TO", label: "TO - Tocantins" },
];

interface ProcessoResult {
  numero: string;
  tribunal?: string;
  classe: string;
  assunto: string;
  dataDistribuicao: string;
  orgaoJulgador?: string;
  valorCausa?: number;
  poloAtivo: string[];
  poloPassivo: string[];
}

interface SearchResult {
  numero: string;
  tribunal: string;
  classe: string;
  assunto: string;
  dataDistribuicao: string;
  vara: string;
  valor: string;
  partes: {
    poloAtivo: string[];
    poloPassivo: string[];
  };
  movimentacoes: Array<{
    data: string;
    descricao: string;
  }>;
}

const BuscarProcessos = () => {
  // Filter states
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [tribunal, setTribunal] = useState("auto");
  const [nomeParte, setNomeParte] = useState("");
  const [classeJudicial, setClasseJudicial] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [oab, setOab] = useState("");
  const [uf, setUf] = useState("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  
  // Results states
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [processosList, setProcessosList] = useState<ProcessoResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);

  // Formatar número do processo no padrão CNJ
  const formatarNumeroProcesso = (valor: string) => {
    const numeros = valor.replace(/\D/g, '');
    
    if (numeros.length <= 7) return numeros;
    if (numeros.length <= 9) return `${numeros.slice(0, 7)}-${numeros.slice(7)}`;
    if (numeros.length <= 13) return `${numeros.slice(0, 7)}-${numeros.slice(7, 9)}.${numeros.slice(9)}`;
    if (numeros.length <= 14) return `${numeros.slice(0, 7)}-${numeros.slice(7, 9)}.${numeros.slice(9, 13)}.${numeros.slice(13)}`;
    if (numeros.length <= 16) return `${numeros.slice(0, 7)}-${numeros.slice(7, 9)}.${numeros.slice(9, 13)}.${numeros.slice(13, 14)}.${numeros.slice(14)}`;
    
    return `${numeros.slice(0, 7)}-${numeros.slice(7, 9)}.${numeros.slice(9, 13)}.${numeros.slice(13, 14)}.${numeros.slice(14, 16)}.${numeros.slice(16, 20)}`;
  };

  const handleNumeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatarNumeroProcesso(e.target.value);
    setNumeroProcesso(formatted);
  };

  const formatarCpfCnpj = (valor: string) => {
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 11) {
      // CPF: 000.000.000-00
      return numeros
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // CNPJ: 00.000.000/0000-00
      return numeros
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  };

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatarCpfCnpj(e.target.value);
    setCpfCnpj(formatted);
  };

  const formatarData = (dataString: string | null) => {
    if (!dataString) return '-';
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR');
    } catch {
      return dataString;
    }
  };

  const limparFiltros = () => {
    setNumeroProcesso("");
    setTribunal("auto");
    setNomeParte("");
    setClasseJudicial("");
    setCpfCnpj("");
    setOab("");
    setUf("");
    setDataInicio(undefined);
    setDataFim(undefined);
    setSearchResult(null);
    setProcessosList([]);
    setTotalResults(0);
  };

  const handleSearch = async () => {
    // Validate that at least one filter is filled
    const hasFilters = numeroProcesso || nomeParte || classeJudicial || cpfCnpj || oab || dataInicio || dataFim;
    const hasTribunal = tribunal !== "auto" || uf;
    
    if (!hasFilters) {
      toast.error("Informe pelo menos um critério de busca");
      return;
    }
    
    // If searching by anything other than full process number, require tribunal/UF
    const numeroLimpo = numeroProcesso.replace(/\D/g, '');
    if (numeroLimpo.length < 15 && !hasTribunal) {
      toast.error("Selecione o tribunal ou UF para buscas com filtros");
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    setProcessosList([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('consultar-processo', {
        body: { 
          numeroProcesso: numeroProcesso || undefined,
          tribunal: tribunal === "auto" ? undefined : tribunal,
          nomeParte: nomeParte || undefined,
          classeJudicial: classeJudicial || undefined,
          cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : undefined,
          oab: oab || undefined,
          uf: uf || undefined,
          dataInicio: dataInicio ? format(dataInicio, 'yyyy-MM-dd') : undefined,
          dataFim: dataFim ? format(dataFim, 'yyyy-MM-dd') : undefined,
          size: 50
        }
      });

      if (error) {
        console.error("Erro na consulta:", error);
        toast.error("Erro ao consultar processo. Tente novamente.");
        return;
      }

      if (data.error) {
        toast.warning(data.error);
        return;
      }

      // Single result with details
      if (data.processo) {
        const processo = data.processo;
        setSearchResult({
          numero: processo.numero || numeroProcesso,
          tribunal: processo.tribunal || data.tribunal || "Tribunal não identificado",
          classe: processo.classe || "-",
          assunto: processo.assunto || "-",
          dataDistribuicao: formatarData(processo.dataDistribuicao),
          vara: processo.orgaoJulgador || "-",
          valor: processo.valorCausa ? `R$ ${Number(processo.valorCausa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "-",
          partes: {
            poloAtivo: processo.poloAtivo || [],
            poloPassivo: processo.poloPassivo || [],
          },
          movimentacoes: (data.movimentacoes || []).slice(0, 10).map((mov: any) => ({
            data: formatarData(mov.dataHora),
            descricao: mov.nome || mov.descricao || "Movimentação"
          }))
        });
        setTotalResults(1);
        toast.success("Processo encontrado!");
      } 
      // Multiple results
      else if (data.processos && data.processos.length > 0) {
        setProcessosList(data.processos);
        setTotalResults(data.total || data.processos.length);
        toast.success(`${data.processos.length} processos encontrados`);
      } else {
        toast.warning("Nenhum processo encontrado com os critérios informados");
      }
      
    } catch (err) {
      console.error("Erro na busca:", err);
      toast.error("Erro ao consultar processo. Verifique os filtros e tente novamente.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectProcess = async (processo: ProcessoResult) => {
    // Search for the specific process to get full details
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('consultar-processo', {
        body: { numeroProcesso: processo.numero }
      });

      if (error || data.error) {
        toast.error("Erro ao carregar detalhes do processo");
        return;
      }

      if (data.processo) {
        const p = data.processo;
        setSearchResult({
          numero: p.numero,
          tribunal: p.tribunal || data.tribunal,
          classe: p.classe || "-",
          assunto: p.assunto || "-",
          dataDistribuicao: formatarData(p.dataDistribuicao),
          vara: p.orgaoJulgador || "-",
          valor: p.valorCausa ? `R$ ${Number(p.valorCausa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "-",
          partes: {
            poloAtivo: p.poloAtivo || [],
            poloPassivo: p.poloPassivo || [],
          },
          movimentacoes: (data.movimentacoes || []).slice(0, 10).map((mov: any) => ({
            data: formatarData(mov.dataHora),
            descricao: mov.nome || mov.descricao || "Movimentação"
          }))
        });
        setProcessosList([]);
      }
    } catch (err) {
      toast.error("Erro ao carregar detalhes");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <MainLayout 
      title="Buscar Processos" 
      subtitle="Consulta em tribunais externos via DataJud/CNJ"
    >
      <div className="space-y-6">
        {/* Search Filters Card */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <Filter className="w-5 h-5 text-gold" />
              Filtros de Busca
            </CardTitle>
            <CardDescription>
              Preencha os filtros desejados. Para buscas por nome, classe, CPF/CNPJ ou OAB, selecione o tribunal ou UF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Tribunal */}
              <div className="space-y-2">
                <Label>Tribunal</Label>
                <Select value={tribunal} onValueChange={setTribunal}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tribunal" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {tribunaisOpcoes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* UF */}
              <div className="space-y-2">
                <Label>UF</Label>
                <Select value={uf} onValueChange={setUf}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a UF" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {ufOpcoes.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Número do Processo */}
              <div className="space-y-2">
                <Label>Processo Referência</Label>
                <Input
                  placeholder="Numeração única ou livre"
                  value={numeroProcesso}
                  onChange={handleNumeroChange}
                  maxLength={25}
                />
              </div>

              {/* Nome da Parte */}
              <div className="space-y-2">
                <Label>Nome da Parte</Label>
                <Input
                  placeholder="Nome completo ou parcial"
                  value={nomeParte}
                  onChange={(e) => setNomeParte(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Classe Judicial */}
              <div className="space-y-2">
                <Label>Classe Judicial</Label>
                <Input
                  placeholder="Ex: Ação Civil Pública"
                  value={classeJudicial}
                  onChange={(e) => setClasseJudicial(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* CPF ou CNPJ */}
              <div className="space-y-2">
                <Label>CPF ou CNPJ</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  onChange={handleCpfCnpjChange}
                  maxLength={18}
                />
              </div>

              {/* OAB */}
              <div className="space-y-2">
                <Label>OAB</Label>
                <Input
                  placeholder="Ex: 12345"
                  value={oab}
                  onChange={(e) => setOab(e.target.value)}
                  maxLength={20}
                />
              </div>

              {/* Data de Autuação - De */}
              <div className="space-y-2">
                <Label>Data Autuação - De</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dataInicio && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dataInicio}
                      onSelect={setDataInicio}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Data de Autuação - Até */}
              <div className="space-y-2">
                <Label>Data Autuação - Até</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dataFim && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dataFim ? format(dataFim, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dataFim}
                      onSelect={setDataFim}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <Button 
                className="bg-primary hover:bg-primary/90" 
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={limparFiltros}>
                Limpar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {!searchResult && !isSearching && processosList.length === 0 && (
          <Card className="animate-fade-in">
            <CardContent className="text-center py-12">
              <Search className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
                Realize uma busca
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Preencha os filtros acima para consultar processos diretamente na API DataJud/CNJ
              </p>
            </CardContent>
          </Card>
        )}

        {isSearching && (
          <Card className="animate-fade-in">
            <CardContent className="text-center py-12">
              <Loader2 className="w-16 h-16 text-gold mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
                Consultando DataJud...
              </h3>
              <p className="text-muted-foreground">
                Buscando informações na API do CNJ
              </p>
            </CardContent>
          </Card>
        )}

        {/* Multiple Results List */}
        {processosList.length > 0 && !searchResult && !isSearching && (
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle className="font-serif">
                Resultados da Busca
                <Badge variant="secondary" className="ml-2">
                  {totalResults} encontrados
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Polo Ativo</TableHead>
                    <TableHead>Polo Passivo</TableHead>
                    <TableHead>Data Autuação</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processosList.map((processo, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">
                        {processo.numero}
                      </TableCell>
                      <TableCell className="text-sm">
                        {processo.classe || '-'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {processo.poloAtivo?.join(', ') || '-'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {processo.poloPassivo?.join(', ') || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatarData(processo.dataDistribuicao)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleSelectProcess(processo)}
                        >
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Single Result Details */}
        {searchResult && !isSearching && (
          <div className="space-y-4 animate-slide-up">
            {processosList.length > 0 && (
              <Button 
                variant="ghost" 
                onClick={() => setSearchResult(null)}
                className="mb-2"
              >
                ← Voltar para lista
              </Button>
            )}
            
            {/* Process Header */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-mono text-lg">{searchResult.numero}</CardTitle>
                    <CardDescription className="mt-1">{searchResult.tribunal}</CardDescription>
                  </div>
                  <Badge className="badge-status-active">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Encontrado
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Classe</p>
                    <p className="text-sm font-medium">{searchResult.classe}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assunto</p>
                    <p className="text-sm font-medium">{searchResult.assunto}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Distribuição</p>
                    <p className="text-sm font-medium">{searchResult.dataDistribuicao}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor da Causa</p>
                    <p className="text-sm font-medium">{searchResult.valor}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parties */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-serif">Partes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Polo Ativo</p>
                    {searchResult.partes.poloAtivo.length > 0 ? (
                      <div className="space-y-1">
                        {searchResult.partes.poloAtivo.map((parte, idx) => (
                          <p key={idx} className="font-medium text-sm">{parte}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">Não informado</p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Polo Passivo</p>
                    {searchResult.partes.poloPassivo.length > 0 ? (
                      <div className="space-y-1">
                        {searchResult.partes.poloPassivo.map((parte, idx) => (
                          <p key={idx} className="font-medium text-sm">{parte}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">Não informado</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Movements */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-serif">Últimas Movimentações</CardTitle>
              </CardHeader>
              <CardContent>
                {searchResult.movimentacoes.length > 0 ? (
                  <div className="space-y-3">
                    {searchResult.movimentacoes.map((mov, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <div className="w-2 h-2 rounded-full bg-gold mt-2 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{mov.descricao}</p>
                          <p className="text-xs text-muted-foreground">{mov.data}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhuma movimentação encontrada</p>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button className="flex-1 bg-primary hover:bg-primary/90">
                Importar para o Sistema
              </Button>
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver no Tribunal
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default BuscarProcessos;
