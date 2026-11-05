import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Zap, FileSpreadsheet } from "lucide-react";
import { baixarRelatorioIara, filtrarSituacao, type LinhaDjenAuto, type SituacaoDjen } from "@/lib/relatorioDistribuicaoDjenAuto";

const hojeBr = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const inicioMes = () => hojeBr().slice(0, 8) + "01";

export function DjenAutomaticoSheet({ onAtualizado }: { onAtualizado?: () => void }) {
  const [open, setOpen] = useState(false);
  const [dias, setDias] = useState("7");
  const [buscando, setBuscando] = useState(false);
  const [de, setDe] = useState(inicioMes());
  const [ate, setAte] = useState(hojeBr());
  const [campo, setCampo] = useState<"lancamento" | "distribuicao">("lancamento");
  const [situacao, setSituacao] = useState<SituacaoDjen>("todos");
  const [gerando, setGerando] = useState(false);
  const [resumo, setResumo] = useState<{ novos: number; existiam: number } | null>(null);

  const [resultadoBusca, setResultadoBusca] = useState<{ ok: boolean; texto: string } | null>(null);
  const buscarAgora = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    setBuscando(true);
    setResultadoBusca(null);
    try {
      const { data, error } = await supabase.rpc("buscar_distribuicoes_tst_agora" as any, { _dias: Number(dias) || 7 });
      if (error) {
        const msg = error.message === "sem acesso" ? "Você não tem acesso a esta busca" : error.message;
        setResultadoBusca({ ok: false, texto: msg });
        toast.error(msg);
        return;
      }
      const n = Number(data) || 0;
      const texto = n > 0
        ? `${n} distribuição(ões) lançada(s) a partir do DJEN.`
        : `Nenhuma distribuição nova encontrada nos últimos ${Number(dias) || 7} dias (as já lidas não são repetidas).`;
      setResultadoBusca({ ok: true, texto });
      toast.success(texto);
      onAtualizado?.();
    } catch (err: any) {
      setResultadoBusca({ ok: false, texto: err?.message || "Erro na busca" });
    } finally {
      setBuscando(false);
    }
  };

  const carregar = async (): Promise<LinhaDjenAuto[]> => {
    const out: LinhaDjenAuto[] = [];
    for (let from = 0; ; from += 1000) {
      let q = supabase
        .from("dados_benner" as any)
        .select("processo, dossie, equipe, data_distribuicao_real, centralizador, importado_djen_em, ja_existia_antes_djen")
        .not("importado_djen_em", "is", null);
      if (campo === "lancamento") {
        q = q.gte("importado_djen_em", `${de}T00:00:00-03:00`).lte("importado_djen_em", `${ate}T23:59:59-03:00`);
      } else {
        q = q.gte("data_distribuicao_real", de).lte("data_distribuicao_real", ate);
      }
      const { data, error } = await q.order("data_distribuicao_real").range(from, from + 999);
      if (error) throw error;
      out.push(...((data as any[]) || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };

  const gerar = async () => {
    setGerando(true);
    try {
      const todas = await carregar();
      setResumo({
        novos: todas.filter((l) => l.ja_existia_antes_djen === false).length,
        existiam: todas.filter((l) => l.ja_existia_antes_djen === true).length,
      });
      const linhas = filtrarSituacao(todas, situacao);
      if (!linhas.length) return toast.info("Nenhum processo nesse período");
      baixarRelatorioIara(linhas, `relatorio-distribuicao-tst-${de}-a-${ate}.xlsx`);
      toast.success(`Relatório gerado com ${linhas.length} processo(s)`);
    } catch (e: any) {
      toast.error("Erro ao gerar relatório: " + e.message);
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Zap className="w-4 h-4 mr-2" /> DJEN automático
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Distribuições pelo DJEN</SheetTitle>
            <SheetDescription>
              Todo dia, ao terminar o DJEN Servidor, as listas de distribuição do TST entram aqui com a etiqueta DJEN AUTOMÁTICO.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3 rounded-md border p-4">
            <p className="font-medium text-sm">Buscar agora</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Publicações dos últimos (dias)</Label>
                <Input type="number" min={1} max={180} value={dias} onChange={(e) => setDias(e.target.value)} />
              </div>
              <Button type="button" onClick={buscarAgora} disabled={buscando}>
                {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>
            {buscando && <p className="text-xs text-muted-foreground">Buscando publicações… pode levar alguns segundos.</p>}
            {resultadoBusca && (
              <p className={`text-xs ${resultadoBusca.ok ? "text-muted-foreground" : "text-destructive"}`}>{resultadoBusca.texto}</p>
            )}
          </div>

          <div className="mt-4 space-y-3 rounded-md border p-4">
            <p className="font-medium text-sm">Relatório para Dra. Iara</p>
            <div>
              <Label className="text-xs">Período por</Label>
              <Select value={campo} onValueChange={(v) => setCampo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lancamento">Data de lançamento no sistema</SelectItem>
                  <SelectItem value="distribuicao">Data da distribuição</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
              <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
            </div>
            <div>
              <Label className="text-xs">Quais processos</Label>
              <Select value={situacao} onValueChange={(v) => setSituacao(v as SituacaoDjen)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="novos">Cadastrados pela rotina (novos)</SelectItem>
                  <SelectItem value="ja_existiam">Já estavam no sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={gerar} disabled={gerando}>
              {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              Gerar planilha
            </Button>
            {resumo && (
              <p className="text-xs text-muted-foreground">
                No período: {resumo.novos} novo(s) e {resumo.existiam} que já estavam no sistema.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
