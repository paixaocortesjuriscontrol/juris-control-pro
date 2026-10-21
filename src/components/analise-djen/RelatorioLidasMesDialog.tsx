import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

type Linha = {
  lida_em: string;
  usuario: string;
  data_publicacao: string | null;
  processo: string | null;
  tribunal: string | null;
  origem: string;
  coordenacao: string;
};

const ORIGEM_LABEL: Record<string, string> = { termo: "Termos", processo: "Processos", descartada: "Descartada" };

const fmtBRT = (iso: string | null, hora = false) => {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00Z" : iso);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    ...(hora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

function mesAtual() {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return s.slice(0, 7);
}

export function RelatorioLidasMesDialog() {
  const [open, setOpen] = useState(false);
  const [coord, setCoord] = useState<string>("");
  const [mes, setMes] = useState(mesAtual());
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const { data: coords } = useQuery({
    queryKey: ["relatorio-lidas-coords"],
    queryFn: async () => (await supabase.from("coordenacoes").select("id, nome").order("nome")).data ?? [],
    enabled: open,
  });
  const coordNome = new Map((coords ?? []).map((c) => [c.id, c.nome]));

  const gerar = async () => {
    if (!coord) { toast.error("Selecione a coordenação ou Todas."); return; }
    setLoading(true);
    setLinhas(null);
    try {
      const [a, m] = mes.split("-").map(Number);
      const ini = new Date(Date.UTC(a, m - 1, 1, 3)).toISOString();
      const fim = new Date(Date.UTC(a, m, 1, 3)).toISOString();
      const rows: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any)
          .rpc("relatorio_publicacoes_lidas", { p_ini: ini, p_fim: fim, p_coord: coord === "todas" ? null : coord })
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      const out: Linha[] = rows.map((r) => ({
        lida_em: r.lida_em,
        usuario: r.usuario || "—",
        data_publicacao: r.data_publicacao,
        processo: r.processo,
        tribunal: r.tribunal,
        origem: ORIGEM_LABEL[r.origem] ?? r.origem,
        coordenacao: coordNome.get(r.coordenacao_id) ?? "—",
      }));
      setLinhas(out);
    } catch (e: any) {
      toast.error("Erro ao gerar relatório: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const porUsuario = (linhas ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.usuario] = (acc[l.usuario] ?? 0) + 1;
    return acc;
  }, {});

  const exportar = () => {
    if (!linhas) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas.map((l) => ({
      "Lida em": fmtBRT(l.lida_em, true),
      "Lida por": l.usuario,
      "Data publicação": fmtBRT(l.data_publicacao),
      Processo: l.processo ?? "",
      Tribunal: l.tribunal ?? "",
      Origem: l.origem,
      Coordenação: l.coordenacao,
    }))), "Lidas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      Object.entries(porUsuario).sort((a, b) => b[1] - a[1]).map(([u, n]) => ({ Usuário: u, Lidas: n }))
    ), "Por usuário");
    XLSX.writeFile(wb, `Publicacoes_lidas_${mes}.xlsx`);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs md:text-sm h-8 md:h-9 px-2 md:px-3">
          <BookOpenCheck className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
          <span className="hidden sm:inline">Lidas no mês</span>
          <span className="sm:hidden">Lidas</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader><SheetTitle>Relatório de publicações lidas no mês</SheetTitle></SheetHeader>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] items-end">
          <div>
            <Label className="text-sm">Coordenação<span className="text-destructive">*</span></Label>
            <Select value={coord} onValueChange={setCoord}>
              <SelectTrigger className="h-10 mt-1.5"><SelectValue placeholder="Selecione a coordenação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as coordenações</SelectItem>
                {(coords ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Mês</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-10 mt-1.5" />
          </div>
          <Button onClick={gerar} disabled={loading || !coord || !mes} className="h-10">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Gerar
          </Button>
        </div>
        {linhas && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <strong>{linhas.length} leituras</strong>
              {Object.entries(porUsuario).sort((a, b) => b[1] - a[1]).map(([u, n]) => (
                <span key={u} className="rounded bg-muted px-2 py-0.5">{u}: {n}</span>
              ))}
              <Button size="sm" variant="outline" className="ml-auto" onClick={exportar} disabled={!linhas.length}>
                <FileSpreadsheet className="w-4 h-4 mr-1" />Exportar Excel
              </Button>
            </div>
            <div className="border rounded overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>{["Lida em", "Lida por", "Data publ.", "Processo", "Tribunal", "Origem", "Coordenação"].map((h) => <th key={h} className="text-left p-2">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {linhas.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nenhuma publicação lida neste mês.</td></tr>}
                  {linhas.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 whitespace-nowrap">{fmtBRT(l.lida_em, true)}</td>
                      <td className="p-2">{l.usuario}</td>
                      <td className="p-2 whitespace-nowrap">{fmtBRT(l.data_publicacao)}</td>
                      <td className="p-2 whitespace-nowrap">{l.processo}</td>
                      <td className="p-2">{l.tribunal}</td>
                      <td className="p-2">{l.origem}</td>
                      <td className="p-2">{l.coordenacao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
