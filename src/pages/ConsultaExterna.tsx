import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, Scale, Building2, Calendar, FileText, Users, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Movimento {
  data: string;
  nome: string;
  complemento?: string;
}

interface Parte {
  tipo: string;
  nome: string;
  tipoParte?: string;
}

interface ProcessoData {
  numero: string;
  classe: string;
  assunto: string;
  orgaoJulgador: string;
  dataAjuizamento: string;
  grau: string;
  nivelSigilo: number;
  formato: string;
  sistema: string;
  tribunal: string;
  partes: Parte[];
}

interface ConsultaResult {
  found: boolean;
  tribunal: string;
  processo?: ProcessoData;
  movimentos?: Movimento[];
  message?: string;
  error?: string;
}

const tribunaisOpcoes = [
  { value: "auto", label: "Detectar automaticamente" },
  { group: "Tribunais Superiores", options: [
    { value: "api_publica_stj", label: "STJ - Superior Tribunal de Justiça" },
    { value: "api_publica_tst", label: "TST - Tribunal Superior do Trabalho" },
    { value: "api_publica_tse", label: "TSE - Tribunal Superior Eleitoral" },
    { value: "api_publica_stm", label: "STM - Superior Tribunal Militar" }
  ]},
  { group: "Justiça Federal", options: [
    { value: "api_publica_trf1", label: "TRF1 - 1ª Região" },
    { value: "api_publica_trf2", label: "TRF2 - 2ª Região" },
    { value: "api_publica_trf3", label: "TRF3 - 3ª Região" },
    { value: "api_publica_trf4", label: "TRF4 - 4ª Região" },
    { value: "api_publica_trf5", label: "TRF5 - 5ª Região" },
    { value: "api_publica_trf6", label: "TRF6 - 6ª Região" }
  ]},
  { group: "Justiça Estadual", options: [
    { value: "api_publica_tjsp", label: "TJSP - São Paulo" },
    { value: "api_publica_tjrj", label: "TJRJ - Rio de Janeiro" },
    { value: "api_publica_tjmg", label: "TJMG - Minas Gerais" },
    { value: "api_publica_tjrs", label: "TJRS - Rio Grande do Sul" },
    { value: "api_publica_tjpr", label: "TJPR - Paraná" },
    { value: "api_publica_tjsc", label: "TJSC - Santa Catarina" },
    { value: "api_publica_tjba", label: "TJBA - Bahia" },
    { value: "api_publica_tjpe", label: "TJPE - Pernambuco" },
    { value: "api_publica_tjce", label: "TJCE - Ceará" },
    { value: "api_publica_tjgo", label: "TJGO - Goiás" },
    { value: "api_publica_tjdft", label: "TJDFT - Distrito Federal" },
    { value: "api_publica_tjes", label: "TJES - Espírito Santo" },
    { value: "api_publica_tjma", label: "TJMA - Maranhão" },
    { value: "api_publica_tjmt", label: "TJMT - Mato Grosso" },
    { value: "api_publica_tjms", label: "TJMS - Mato Grosso do Sul" },
    { value: "api_publica_tjpa", label: "TJPA - Pará" },
    { value: "api_publica_tjpb", label: "TJPB - Paraíba" },
    { value: "api_publica_tjpi", label: "TJPI - Piauí" },
    { value: "api_publica_tjrn", label: "TJRN - Rio Grande do Norte" },
    { value: "api_publica_tjal", label: "TJAL - Alagoas" },
    { value: "api_publica_tjse", label: "TJSE - Sergipe" },
    { value: "api_publica_tjam", label: "TJAM - Amazonas" },
    { value: "api_publica_tjac", label: "TJAC - Acre" },
    { value: "api_publica_tjap", label: "TJAP - Amapá" },
    { value: "api_publica_tjro", label: "TJRO - Rondônia" },
    { value: "api_publica_tjrr", label: "TJRR - Roraima" },
    { value: "api_publica_tjto", label: "TJTO - Tocantins" }
  ]}
];

const ConsultaExterna = () => {
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [tribunalSelecionado, setTribunalSelecionado] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ConsultaResult | null>(null);

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

  const consultarProcesso = async () => {
    if (!numeroProcesso || numeroProcesso.replace(/\D/g, '').length < 15) {
      toast.error("Digite um número de processo válido");
      return;
    }

    setLoading(true);
    setResultado(null);

    try {
      const { data, error } = await supabase.functions.invoke('consultar-processo', {
        body: {
          numeroProcesso,
          tribunal: tribunalSelecionado === "auto" ? null : tribunalSelecionado
        }
      });

      if (error) {
        console.error("Erro na consulta:", error);
        toast.error("Erro ao consultar processo");
        return;
      }

      if (data.error) {
        toast.error(data.error);
        setResultado({ found: false, tribunal: "", message: data.error });
        return;
      }

      setResultado(data);
      
      if (data.found) {
        toast.success(`Processo encontrado no ${data.tribunal}`);
      } else {
        toast.warning(data.message || "Processo não encontrado");
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao consultar processo");
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string) => {
    if (!data) return "-";
    try {
      return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return data;
    }
  };

  return (
    <MainLayout title="Consulta Externa" subtitle="Busque andamentos processuais em tribunais de todo o Brasil">
      <div className="space-y-6">
        {/* Search Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Consulta no DataJud/CNJ
            </CardTitle>
            <CardDescription>
              Busque informações de processos diretamente na base nacional do Poder Judiciário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="numero">Número do Processo (CNJ)</Label>
                <Input
                  id="numero"
                  placeholder="0000000-00.0000.0.00.0000"
                  value={numeroProcesso}
                  onChange={handleNumeroChange}
                  maxLength={25}
                />
                <p className="text-xs text-muted-foreground">
                  Formato: NNNNNNN-DD.AAAA.J.TR.OOOO
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tribunal">Tribunal</Label>
                <Select value={tribunalSelecionado} onValueChange={setTribunalSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tribunal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Detectar automaticamente</SelectItem>
                    {tribunaisOpcoes.slice(1).map((group) => (
                      'group' in group && group.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={consultarProcesso}
              disabled={loading}
              className="mt-4 w-full md:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Consultando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Consultar Processo
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resultado */}
        {resultado && (
          <>
            {resultado.found && resultado.processo ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Dados do Processo */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Scale className="w-5 h-5" />
                      Dados do Processo
                    </CardTitle>
                    <Badge variant="outline" className="w-fit">
                      {resultado.tribunal}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 mt-1 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Número</p>
                          <p className="font-medium">{resultado.processo.numero}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Scale className="w-4 h-4 mt-1 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Classe</p>
                          <p className="font-medium">{resultado.processo.classe || "-"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 mt-1 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Assunto</p>
                          <p className="font-medium">{resultado.processo.assunto || "-"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Building2 className="w-4 h-4 mt-1 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Órgão Julgador</p>
                          <p className="font-medium">{resultado.processo.orgaoJulgador || "-"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Calendar className="w-4 h-4 mt-1 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Data de Ajuizamento</p>
                          <p className="font-medium">{formatarData(resultado.processo.dataAjuizamento)}</p>
                        </div>
                      </div>

                      {resultado.processo.grau && (
                        <div>
                          <p className="text-sm text-muted-foreground">Grau</p>
                          <Badge variant="secondary">{resultado.processo.grau}</Badge>
                        </div>
                      )}
                    </div>

                    {resultado.processo.partes && resultado.processo.partes.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <p className="font-medium">Partes</p>
                          </div>
                          <div className="space-y-2">
                            {resultado.processo.partes.slice(0, 10).map((parte, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {parte.tipo || parte.tipoParte}
                                </Badge>
                                <span className="text-sm">{parte.nome}</span>
                              </div>
                            ))}
                            {resultado.processo.partes.length > 10 && (
                              <p className="text-sm text-muted-foreground">
                                + {resultado.processo.partes.length - 10} outras partes
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Movimentações */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Movimentações
                    </CardTitle>
                    <CardDescription>
                      {resultado.movimentos?.length || 0} movimentação(ões) encontrada(s)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {resultado.movimentos?.map((mov, index) => (
                          <div key={index} className="border-l-2 border-primary/30 pl-4 py-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Calendar className="w-3 h-3" />
                              {formatarData(mov.data)}
                            </div>
                            <p className="font-medium text-sm">{mov.nome}</p>
                            {mov.complemento && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {mov.complemento}
                              </p>
                            )}
                          </div>
                        ))}
                        
                        {(!resultado.movimentos || resultado.movimentos.length === 0) && (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Nenhuma movimentação encontrada</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">Processo não encontrado</h3>
                    <p className="text-muted-foreground">
                      {resultado.message || "Verifique o número do processo e tente novamente."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default ConsultaExterna;
