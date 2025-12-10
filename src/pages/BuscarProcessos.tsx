import { useState } from "react";
import { Search, Globe, FileSearch, Loader2, ExternalLink, AlertCircle, CheckCircle } from "lucide-react";
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

// Tribunais organizados por categoria
const tribunaisOpcoes = [
  // Tribunais Superiores
  { value: "auto", label: "Auto-detectar pelo número do processo" },
  { value: "stf", label: "STF - Supremo Tribunal Federal" },
  { value: "stj", label: "STJ - Superior Tribunal de Justiça" },
  { value: "tst", label: "TST - Tribunal Superior do Trabalho" },
  
  // Tribunais Federais
  { value: "trf1", label: "TRF1 - Tribunal Regional Federal 1ª Região" },
  { value: "trf2", label: "TRF2 - Tribunal Regional Federal 2ª Região" },
  { value: "trf3", label: "TRF3 - Tribunal Regional Federal 3ª Região" },
  { value: "trf4", label: "TRF4 - Tribunal Regional Federal 4ª Região" },
  { value: "trf5", label: "TRF5 - Tribunal Regional Federal 5ª Região" },
  { value: "trf6", label: "TRF6 - Tribunal Regional Federal 6ª Região" },
  
  // Tribunais Estaduais
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
  
  // Tribunais do Trabalho
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
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [tribunal, setTribunal] = useState("auto");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

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

  const formatarData = (dataString: string | null) => {
    if (!dataString) return '-';
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR');
    } catch {
      return dataString;
    }
  };

  const handleSearch = async () => {
    if (!numeroProcesso) {
      toast.error("Informe o número do processo para realizar a busca");
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('consultar-processo', {
        body: { 
          numeroProcesso,
          tribunal: tribunal === "auto" ? undefined : tribunal
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

      if (!data.processo) {
        toast.warning("Processo não encontrado no tribunal selecionado");
        return;
      }

      // Mapear os dados recebidos para o formato do resultado
      const processo = data.processo;
      
      setSearchResult({
        numero: processo.numero || numeroProcesso,
        tribunal: processo.tribunal || data.tribunal || "Tribunal não identificado",
        classe: processo.classe || "-",
        assunto: processo.assunto || "-",
        dataDistribuicao: formatarData(processo.dataDistribuicao),
        vara: processo.orgaoJulgador || processo.vara || "-",
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
      
      toast.success("Processo encontrado com sucesso!");
    } catch (err) {
      console.error("Erro na busca:", err);
      toast.error("Erro ao consultar processo. Verifique o número e tente novamente.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <MainLayout 
      title="Buscar Processos" 
      subtitle="Consulta em tribunais externos"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search Form */}
        <div className="lg:col-span-1">
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Globe className="w-5 h-5 text-gold" />
                Consulta Externa
              </CardTitle>
              <CardDescription>
                Busque processos diretamente nos sistemas dos tribunais via DataJud/CNJ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tribunal">Tribunal</Label>
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

              <div className="space-y-2">
                <Label htmlFor="numero">Número do Processo</Label>
                <Input
                  id="numero"
                  placeholder="0000000-00.0000.0.00.0000"
                  value={numeroProcesso}
                  onChange={handleNumeroChange}
                  maxLength={25}
                />
              </div>

              <Button 
                className="w-full bg-primary hover:bg-primary/90" 
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Consultando DataJud...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Buscar Processo
                  </>
                )}
              </Button>

              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  Busca integrada com a API DataJud/CNJ. Os dados são obtidos em tempo real dos sistemas judiciais.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Info Cards */}
          <Card className="mt-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                  <FileSearch className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">Importação Automática</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Após localizar o processo, importe-o para o sistema com um clique
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Results */}
        <div className="lg:col-span-2">
          {!searchResult && !isSearching && (
            <Card className="h-full flex items-center justify-center animate-fade-in">
              <CardContent className="text-center py-12">
                <Search className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
                  Realize uma busca
                </h3>
                <p className="text-muted-foreground max-w-md">
                  Informe o número do processo no formato CNJ para consultar as informações diretamente na fonte
                </p>
              </CardContent>
            </Card>
          )}

          {isSearching && (
            <Card className="h-full flex items-center justify-center animate-fade-in">
              <CardContent className="text-center py-12">
                <Loader2 className="w-16 h-16 text-gold mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
                  Consultando DataJud...
                </h3>
                <p className="text-muted-foreground">
                  Buscando informações do processo na API do CNJ
                </p>
              </CardContent>
            </Card>
          )}

          {searchResult && !isSearching && (
            <div className="space-y-4 animate-slide-up">
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
      </div>
    </MainLayout>
  );
};

export default BuscarProcessos;
