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

const tribunais = [
  { value: "tjrj", label: "TJRJ - Tribunal de Justiça do Rio de Janeiro" },
  { value: "tjsp", label: "TJSP - Tribunal de Justiça de São Paulo" },
  { value: "trt1", label: "TRT1 - Tribunal Regional do Trabalho 1ª Região" },
  { value: "trt2", label: "TRT2 - Tribunal Regional do Trabalho 2ª Região" },
  { value: "stj", label: "STJ - Superior Tribunal de Justiça" },
  { value: "stf", label: "STF - Supremo Tribunal Federal" },
];

const BuscarProcessos = () => {
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  const handleSearch = async () => {
    if (!numeroProcesso || !tribunal) {
      toast.error("Preencha todos os campos para realizar a busca");
      return;
    }

    setIsSearching(true);
    
    // Simulating API call - in production, this would call the external court API
    setTimeout(() => {
      setSearchResult({
        numero: numeroProcesso,
        tribunal: tribunais.find(t => t.value === tribunal)?.label,
        classe: "Ação de Cobrança",
        assunto: "Contratos Bancários",
        dataDistribuicao: "15/03/2024",
        juizo: "1ª Vara Cível",
        valor: "R$ 75.000,00",
        partes: {
          autor: "Banco XYZ S.A.",
          reu: "Empresa ABC Ltda",
        },
        movimentacoes: [
          { data: "05/12/2024", descricao: "Conclusos para sentença" },
          { data: "28/11/2024", descricao: "Juntada de petição - Alegações Finais" },
          { data: "15/11/2024", descricao: "Juntada de documento" },
          { data: "01/11/2024", descricao: "Audiência de Instrução realizada" },
        ],
      });
      setIsSearching(false);
      toast.success("Processo encontrado com sucesso!");
    }, 2000);
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
                Busque processos diretamente nos sistemas dos tribunais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tribunal">Tribunal</Label>
                <Select value={tribunal} onValueChange={setTribunal}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tribunal" />
                  </SelectTrigger>
                  <SelectContent>
                    {tribunais.map((t) => (
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
                  onChange={(e) => setNumeroProcesso(e.target.value)}
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
                    Buscando...
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
                  Busca integrada com APIs dos tribunais. Os dados são obtidos em tempo real dos sistemas judiciais.
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
                  Selecione o tribunal e informe o número do processo para consultar as informações diretamente na fonte
                </p>
              </CardContent>
            </Card>
          )}

          {isSearching && (
            <Card className="h-full flex items-center justify-center animate-fade-in">
              <CardContent className="text-center py-12">
                <Loader2 className="w-16 h-16 text-gold mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
                  Consultando tribunal...
                </h3>
                <p className="text-muted-foreground">
                  Buscando informações do processo
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
                      <p className="text-xs text-muted-foreground mb-1">Autor</p>
                      <p className="font-medium">{searchResult.partes.autor}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Réu</p>
                      <p className="font-medium">{searchResult.partes.reu}</p>
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
                  <div className="space-y-3">
                    {searchResult.movimentacoes.map((mov: any, index: number) => (
                      <div key={index} className="flex gap-3 items-start">
                        <div className="w-2 h-2 rounded-full bg-gold mt-2 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{mov.descricao}</p>
                          <p className="text-xs text-muted-foreground">{mov.data}</p>
                        </div>
                      </div>
                    ))}
                  </div>
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
