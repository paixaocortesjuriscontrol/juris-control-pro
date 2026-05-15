import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Search, FileText, AlertCircle, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tribunal = {
  sigla: string;
  nome: string;
  cadernos: { id: string; nome: string }[];
};

// Mantido em sync com supabase/functions/_shared/djeEstaduaisTribunais.ts
const TRIBUNAIS: Tribunal[] = [
  {
    sigla: "TJMG",
    nome: "TJMG - Minas Gerais",
    cadernos: [
      { id: "judicial-1", nome: "Judicial - 1ª Instância" },
      { id: "judicial-2", nome: "Judicial - 2ª Instância" },
      { id: "administrativo", nome: "Administrativo" },
    ],
  },
];

type Match = {
  tribunal: string;
  data_publicacao: string;
  caderno: string;
  pagina: number;
  termo: string;
  contexto: string;
  processos: string[];
  pdf_id: string;
};

function highlight(text: string, termo: string) {
  if (!termo) return text;
  const re = new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 px-0.5 rounded">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function BuscarDjEstadual() {
  const hoje = new Date().toISOString().slice(0, 10);
  const [tribunal, setTribunal] = useState<string>("TJMG");
  const [caderno, setCaderno] = useState<string>("judicial-1");
  const [data, setData] = useState<string>(hoje);
  const [termoInput, setTermoInput] = useState("");
  const [termos, setTermos] = useState<string[]>([]);
  const [baixando, setBaixando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [statusPdf, setStatusPdf] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  const tribunalCfg = useMemo(
    () => TRIBUNAIS.find((t) => t.sigla === tribunal),
    [tribunal],
  );

  useEffect(() => {
    if (tribunalCfg && !tribunalCfg.cadernos.find((c) => c.id === caderno)) {
      setCaderno(tribunalCfg.cadernos[0].id);
    }
  }, [tribunalCfg, caderno]);

  function adicionarTermo() {
    const t = termoInput.trim();
    if (t.length < 2) return;
    if (termos.includes(t)) return;
    setTermos([...termos, t]);
    setTermoInput("");
  }

  function removerTermo(t: string) {
    setTermos(termos.filter((x) => x !== t));
  }

  async function baixarPdf() {
    setBaixando(true);
    setMensagem(null);
    setStatusPdf(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke("baixar-dj-estadual", {
        body: { tribunal, data, caderno },
      });
      if (error) throw error;
      if ((resp as any)?.error) throw new Error((resp as any).error);
      const reused = (resp as any)?.reused;
      setStatusPdf(reused ? "já processado" : "baixado");
      setMensagem(reused ? "PDF já estava processado." : "PDF baixado. Agora processe para indexar o conteúdo.");
      toast.success(reused ? "PDF já indexado" : "PDF baixado");
    } catch (e: any) {
      const msg = e?.message || String(e);
      setMensagem(`Erro ao baixar: ${msg}`);
      toast.error(`Erro ao baixar: ${msg}`);
    } finally {
      setBaixando(false);
    }
  }

  async function processarPdf() {
    setProcessando(true);
    setMensagem(null);
    try {
      // procura o registro mais recente (tribunal/data/caderno) para este escopo
      const { data: rec } = await supabase
        .from("dj_estaduais_pdfs" as any)
        .select("id, status")
        .eq("tribunal", tribunal)
        .eq("data_publicacao", data)
        .eq("caderno", caderno)
        .maybeSingle();
      if (!rec) {
        toast.error("Baixe o PDF primeiro.");
        return;
      }
      const { data: resp, error } = await supabase.functions.invoke("processar-dj-estadual", {
        body: { pdf_id: (rec as any).id },
      });
      if (error) throw error;
      const r = (resp as any)?.resultados?.[0];
      if (r?.ok) {
        setStatusPdf("processado");
        setMensagem(`Indexado: ${r.paginas} páginas`);
        toast.success(`PDF processado (${r.paginas} páginas)`);
      } else {
        throw new Error(r?.erro || "Falha ao processar");
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setMensagem(`Erro ao processar: ${msg}`);
      toast.error(`Erro ao processar: ${msg}`);
    } finally {
      setProcessando(false);
    }
  }

  async function buscar() {
    if (termos.length === 0) {
      toast.error("Adicione pelo menos um termo");
      return;
    }
    setBuscando(true);
    setMatches([]);
    try {
      const { data: resp, error } = await supabase.functions.invoke("buscar-dj-estadual-termos", {
        body: {
          tribunal,
          caderno,
          dataInicio: data,
          dataFim: data,
          termos,
        },
      });
      if (error) throw error;
      if ((resp as any)?.error) throw new Error((resp as any).error);
      const ms: Match[] = (resp as any)?.matches || [];
      setMatches(ms);
      const pdfsCount = (resp as any)?.pdfs ?? 0;
      if (ms.length === 0) {
        toast.message(
          pdfsCount === 0
            ? "Nenhum PDF processado para esse escopo. Baixe e processe primeiro."
            : `${pdfsCount} PDF(s) varridos, nenhum match.`,
        );
      } else {
        toast.success(`${ms.length} matches em ${pdfsCount} PDF(s)`);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      toast.error(`Erro na busca: ${msg}`);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <MainLayout
      title="Buscar DJ Estadual"
      subtitle="Indexa e pesquisa Diários de Justiça estaduais (TJMG, etc.) que não são cobertos pelo DJEN"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> Filtros
            </CardTitle>
            <CardDescription>
              Escolha tribunal, caderno e data. Baixe o PDF, processe (Jina extrai o texto) e busque pelos termos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Tribunal</Label>
              <Select value={tribunal} onValueChange={setTribunal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIBUNAIS.map((t) => (
                    <SelectItem key={t.sigla} value={t.sigla}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Caderno</Label>
              <Select value={caderno} onValueChange={setCaderno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tribunalCfg?.cadernos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de publicação</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={baixarPdf} disabled={baixando} variant="outline" className="flex-1">
                {baixando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Baixar PDF
              </Button>
              <Button onClick={processarPdf} disabled={processando} variant="outline" className="flex-1">
                {processando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                Indexar
              </Button>
            </div>
          </CardContent>
          {(statusPdf || mensagem) && (
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 text-sm">
                {statusPdf && <Badge variant="secondary">{statusPdf}</Badge>}
                {mensagem && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {mensagem}
                  </span>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" /> Termos a buscar
            </CardTitle>
            <CardDescription>
              Digite termos (advogado, parte, palavra-chave) e adicione com Enter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={termoInput}
                onChange={(e) => setTermoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarTermo();
                  }
                }}
                placeholder="Ex.: BRADESCO, SANTANDER, OAB/MG 12345"
              />
              <Button onClick={adicionarTermo} variant="outline">
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
            {termos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {termos.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button onClick={() => removerTermo(t)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Button onClick={buscar} disabled={buscando || termos.length === 0} className="w-full">
              {buscando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Buscar nos diários indexados
            </Button>
          </CardContent>
        </Card>

        {matches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados ({matches.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {matches.map((m, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge>{m.tribunal}</Badge>
                    <Badge variant="outline">{m.caderno}</Badge>
                    <Badge variant="outline">{m.data_publicacao}</Badge>
                    <Badge variant="outline">pág. {m.pagina}</Badge>
                    <Badge variant="secondary">termo: {m.termo}</Badge>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {highlight(m.contexto, m.termo)}
                  </div>
                  {m.processos.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Processos detectados: {m.processos.slice(0, 5).join(", ")}
                      {m.processos.length > 5 && ` (+${m.processos.length - 5})`}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}