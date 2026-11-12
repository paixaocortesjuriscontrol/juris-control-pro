import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { gerarRelatorioDistribuicaoModelo, type FiltrosRelatorioDistribuicao } from "@/lib/relatorioDistribuicaoModeloData";

const hojeBrt = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const inicioMesBrt = () => `${hojeBrt().slice(0, 8)}01`;

type Preparado = { blob: Blob; filename: string; total: number };

async function entregarArquivo(blob: Blob, filename: string) {
  const arquivo = new File([blob], filename, { type: blob.type });
  const toque = matchMedia("(pointer: coarse)").matches;
  if (toque && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: filename });
      return;
    } catch (erro) {
      if ((erro as DOMException).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function RelatorioDistribuicaoSheet() {
  const [open, setOpen] = useState(false);
  const [campoData, setCampoData] = useState<FiltrosRelatorioDistribuicao["campoData"]>("distribuicao");
  const [de, setDe] = useState(inicioMesBrt());
  const [ate, setAte] = useState(hojeBrt());
  const [classificacao, setClassificacao] = useState<FiltrosRelatorioDistribuicao["classificacao"]>("todas");
  const [origem, setOrigem] = useState<FiltrosRelatorioDistribuicao["origem"]>("todas");
  const [processo, setProcesso] = useState("");
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [preparado, setPreparado] = useState<Preparado | null>(null);

  useEffect(() => {
    setPreparado(null);
    setProgresso("");
  }, [campoData, de, ate, classificacao, origem, processo]);

  const periodoInvalido = Boolean(de && ate && de > ate);

  const preparar = async () => {
    if (periodoInvalido) {
      toast.error("A data inicial precisa ser anterior ou igual à data final.");
      return;
    }
    setGerando(true);
    setPreparado(null);
    setProgresso("Buscando distribuições…");
    try {
      const resultado = await gerarRelatorioDistribuicaoModelo(
        { campoData, de, ate, classificacao, origem, processo },
        setProgresso,
      );
      if (!resultado.total) {
        toast.info("Nenhuma distribuição encontrada com esses filtros.");
        setProgresso("");
        return;
      }
      setPreparado(resultado);
      setProgresso("");
      toast.success(`Planilha preparada com ${resultado.total} distribuição(ões).`);
    } catch (erro: unknown) {
      setProgresso("");
      const mensagem = erro instanceof Error ? erro.message : "tente novamente";
      toast.error(`Não foi possível gerar o relatório: ${mensagem}`);
    } finally {
      setGerando(false);
    }
  };

  const baixar = () => {
    if (!preparado) return;
    void entregarArquivo(preparado.blob, preparado.filename)
      .then(() => toast.success("Download do Excel iniciado."))
      .catch((erro: unknown) => {
        const mensagem = erro instanceof Error ? erro.message : "tente novamente";
        toast.error(`Não foi possível baixar: ${mensagem}`);
      });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="w-4 h-4 mr-2" /> Relatório Distribuição
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Relatório Distribuição</SheetTitle>
            <SheetDescription>
              Escolha os filtros para gerar o Excel no modelo oficial, com as dez colunas, fórmulas, cores e fontes originais.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="relatorio-campo-data">Período por</Label>
              <Select value={campoData} onValueChange={(v) => setCampoData(v as typeof campoData)} disabled={gerando}>
                <SelectTrigger id="relatorio-campo-data"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="distribuicao">Data da distribuição</SelectItem>
                  <SelectItem value="djen">Data de disponibilização no DJEN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="relatorio-data-inicio">De</Label>
                <Input id="relatorio-data-inicio" type="date" value={de} onChange={(e) => setDe(e.target.value)} disabled={gerando} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relatorio-data-fim">Até</Label>
                <Input id="relatorio-data-fim" type="date" value={ate} onChange={(e) => setAte(e.target.value)} disabled={gerando} />
              </div>
              {periodoInvalido && <p className="col-span-2 text-xs text-destructive">A data inicial está depois da final.</p>}
              <p className="col-span-2 text-xs text-muted-foreground">Limpe as duas datas para incluir todos os períodos.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="relatorio-classificacao">Classificação</Label>
              <Select value={classificacao} onValueChange={(v) => setClassificacao(v as typeof classificacao)} disabled={gerando}>
                <SelectTrigger id="relatorio-classificacao"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="inicial">Distribuição inicial</SelectItem>
                  <SelectItem value="tramite">Trâmite interno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="relatorio-origem">Origem do cadastro</Label>
              <Select value={origem} onValueChange={(v) => setOrigem(v as typeof origem)} disabled={gerando}>
                <SelectTrigger id="relatorio-origem"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="djen">DJEN automático</SelectItem>
                  <SelectItem value="manual">Demais cadastros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="relatorio-processo">Número do processo (opcional)</Label>
              <Input
                id="relatorio-processo"
                value={processo}
                onChange={(e) => setProcesso(e.target.value)}
                placeholder="Completo ou parte do número"
                disabled={gerando}
              />
            </div>

            {progresso && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground" role="status">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> {progresso}
              </div>
            )}

            {preparado && (
              <div className="rounded-md border bg-muted/40 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Planilha pronta</p>
                  <p className="text-xs text-muted-foreground">{preparado.total} distribuição(ões) · {preparado.filename}</p>
                </div>
                <Button type="button" className="w-full" onClick={baixar}>
                  <Download className="mr-2 h-4 w-4" /> Baixar planilha Excel
                </Button>
              </div>
            )}

            <Button type="button" variant={preparado ? "outline" : "default"} className="w-full" onClick={preparar} disabled={gerando || periodoInvalido}>
              {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              {gerando ? "Preparando planilha…" : preparado ? "Preparar novamente" : "Preparar planilha"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
