import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Copy, Download, FileSpreadsheet } from "lucide-react";

type Row = Record<string, any>;

const PAGE = 1000;

async function fetchAll(table: string, columns: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table as any)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

const norm = (v: unknown) => (v ?? "").toString().trim().toUpperCase().replace(/\s+/g, " ");
const dia = (v: unknown) => (v ? String(v).slice(0, 10) : "");

interface Grupo {
  chave: string;
  processo: string;
  coordenacao: string;
  data: string;
  titulo: string;
  quantidade: number;
  itens: Row[];
}

function agrupar(rows: Row[], campoData: string, mapProc: Map<string, string>, mapCoord: Map<string, string>): Grupo[] {
  const groups = new Map<string, Grupo>();
  for (const r of rows) {
    const chave = `${r.processo_id ?? "-"}|${r.coordenacao_id ?? "-"}|${dia(r[campoData])}|${norm(r.titulo)}`;
    let g = groups.get(chave);
    if (!g) {
      g = {
        chave,
        processo: mapProc.get(r.processo_id) ?? r.processo_id ?? "—",
        coordenacao: mapCoord.get(r.coordenacao_id) ?? "—",
        data: dia(r[campoData]),
        titulo: (r.titulo ?? "").toString(),
        quantidade: 0,
        itens: [],
      };
      groups.set(chave, g);
    }
    g.quantidade++;
    g.itens.push(r);
  }
  return [...groups.values()].filter((g) => g.quantidade > 1);
}

export default function RelatorioDuplicados() {
  const [loading, setLoading] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [etapa, setEtapa] = useState("");
  const [resumo, setResumo] = useState<{ tipo: string; grupos: number; registros: number; excedentes: number }[] | null>(null);

  async function gerar() {
    setLoading(true);
    setProgresso(0);
    setResumo(null);
    try {
      setEtapa("Carregando processos e coordenações...");
      const [procs, coords] = await Promise.all([
        fetchAll("processos", "id,numero"),
        fetchAll("coordenacoes", "id,nome"),
      ]);
      const mapProc = new Map<string, string>(procs.map((p) => [p.id, p.numero]));
      const mapCoord = new Map<string, string>(coords.map((c) => [c.id, c.nome]));
      setProgresso(25);

      setEtapa("Carregando tarefas e prazos...");
      const tarefas = await fetchAll(
        "tarefas",
        "id,processo_id,coordenacao_id,titulo,data_vencimento,data_fatal,tipo_tarefa,status,origem,created_at",
      );
      setProgresso(55);

      setEtapa("Carregando audiências...");
      const audiencias = await fetchAll(
        "audiencias_detectadas",
        "id,processo_id,coordenacao_id,titulo,data_audiencia,tipo_audiencia,status,origem,created_at",
      );
      setProgresso(70);

      setEtapa("Carregando eventos da agenda...");
      const eventos = await fetchAll(
        "eventos_agenda",
        "id,processo_id,coordenacao_id,titulo,data_inicio,tipo,status,created_at",
      );
      setProgresso(85);

      setEtapa("Analisando duplicidades...");
      const blocos = [
        { tipo: "Tarefas/Prazos", grupos: agrupar(tarefas, "data_vencimento", mapProc, mapCoord) },
        { tipo: "Audiências", grupos: agrupar(audiencias, "data_audiencia", mapProc, mapCoord) },
        { tipo: "Eventos", grupos: agrupar(eventos, "data_inicio", mapProc, mapCoord) },
      ];

      const wb = XLSX.utils.book_new();

      // Aba resumo
      const resumoRows = blocos.map((b) => ({
        Tipo: b.tipo,
        "Grupos duplicados": b.grupos.length,
        "Registros envolvidos": b.grupos.reduce((s, g) => s + g.quantidade, 0),
        "Excedentes (repetidos)": b.grupos.reduce((s, g) => s + g.quantidade - 1, 0),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), "Resumo");

      // Abas de detalhe
      for (const b of blocos) {
        const detalhe = b.grupos
          .sort((a, z) => (a.data < z.data ? 1 : a.data > z.data ? -1 : 0))
          .flatMap((g, idx) =>
            g.itens
              .sort((a, z) => String(a.created_at).localeCompare(String(z.created_at)))
              .map((it, i) => ({
                "Grupo #": idx + 1,
                Processo: g.processo,
                Coordenação: g.coordenacao,
                Data: g.data ? g.data.split("-").reverse().join("/") : "",
                Título: g.titulo,
                "Qtd. no grupo": g.quantidade,
                Sequência: i + 1,
                "Manter (mais antigo)": i === 0 ? "SIM" : "",
                Tipo: it.tipo_tarefa ?? it.tipo_audiencia ?? it.tipo ?? "",
                Status: it.status ?? "",
                Origem: it.origem ?? "",
                "Criado em": it.created_at ? new Date(it.created_at).toLocaleString("pt-BR") : "",
                ID: it.id,
              })),
          );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(detalhe.length ? detalhe : [{ Info: "Nenhuma duplicidade encontrada" }]),
          b.tipo.replace(/[\\/*?:[\]]/g, "-").slice(0, 31),
        );
      }

      const hoje = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `relatorio-duplicados-${hoje}.xlsx`);
      setResumo(
        blocos.map((b) => ({
          tipo: b.tipo,
          grupos: b.grupos.length,
          registros: b.grupos.reduce((s, g) => s + g.quantidade, 0),
          excedentes: b.grupos.reduce((s, g) => s + g.quantidade - 1, 0),
        })),
      );
      setProgresso(100);
      setEtapa("Relatório gerado.");
      toast.success("Relatório Excel gerado com sucesso.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Falha ao gerar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLayout
      title="Relatório de Duplicados"
      subtitle="Exporta em Excel as tarefas, prazos, audiências e eventos repetidos — sem excluir nada."
    >
      <div className="p-4 lg:p-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Copy className="w-4 h-4" /> Como a duplicidade é identificada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Considera-se repetido todo registro que compartilhe o mesmo{" "}
              <strong>processo + coordenação + data + título</strong>. O relatório marca com{" "}
              <strong>“Manter (mais antigo)”</strong> o primeiro registro criado de cada grupo, apenas como sugestão de
              análise. Nenhum dado é alterado ou excluído.
            </p>
            <Button onClick={gerar} disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              {loading ? "Gerando..." : "Gerar relatório Excel"}
            </Button>
            {loading && (
              <div className="space-y-2">
                <Progress value={progresso} />
                <p className="text-xs text-muted-foreground">{etapa}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {resumo && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" /> Resumo do último relatório
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {resumo.map((r) => (
                  <div key={r.tipo} className="rounded-lg border border-border p-4">
                    <p className="text-sm font-semibold text-foreground">{r.tipo}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.grupos} grupos duplicados</p>
                    <p className="text-xs text-muted-foreground">{r.registros} registros envolvidos</p>
                    <p className="text-xs text-muted-foreground">{r.excedentes} excedentes</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
