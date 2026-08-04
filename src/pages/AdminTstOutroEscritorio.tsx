import { useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { iniciarAuditoriaLote, finalizarAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";
import { supabase } from "@/integrations/supabase/client";
import { loadResponsaveisMap } from "@/hooks/useDistribuicaoResponsaveis";
import { toast } from "sonner";

interface LinhaPlanilha {
  dossie: string;
  processo: string;
  processoDigitos: string;
  equipe: string;
}

interface LinhaResultado {
  dossie: string;
  processo: string;
  equipe: string;
  encontrado: boolean;
  situacaoProcesso: string;
  dataDistribuicao: string;
  responsavel: string;
  emAnalise: string;
  statusEnvio: string;
  jaOutroEscritorio: boolean;
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

const fmtDate = (d: string | null): string => {
  if (!d) return "";
  try {
    const dt = new Date(d.length === 10 ? d + "T12:00:00" : d);
    if (Number.isNaN(dt.getTime())) return "";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${dt.getFullYear()}`;
  } catch {
    return "";
  }
};

const statusEnvioLabel = (s: string | null): string => {
  if (!s) return "";
  const map: Record<string, string> = {
    delegada: "Delegada",
    em_andamento: "Em andamento",
    finalizada: "Finalizada",
  };
  return map[s] || s;
};

export default function AdminTstOutroEscritorio() {
  const [marcarFlag, setMarcarFlag] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [resultado, setResultado] = useState<LinhaResultado[] | null>(null);
  const [stats, setStats] = useState({ total: 0, encontrados: 0, naoEncontrados: 0, marcados: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const processar = async (file: File) => {
    setLoading(true);
    setResultado(null);
    setProgress(0);
    setProgressLabel("Lendo planilha...");

    const auditId = await iniciarAuditoriaLote({
      tipo: "outro_escritorio",
      arquivoNome: file.name,
      detalhes: { marcar_flag: marcarFlag },
    });
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: false });

      const linhas: LinhaPlanilha[] = [];
      for (const r of rows) {
        const keys = Object.keys(r);
        const kDossie = keys.find(k => /dossi/i.test(k));
        const kProc = keys.find(k => /processo/i.test(k));
        const kEquipe = keys.find(k => /equipe/i.test(k));
        const dossie = String(r[kDossie ?? ""] ?? "").trim();
        const processo = String(r[kProc ?? ""] ?? "").trim();
        const equipe = String(r[kEquipe ?? ""] ?? "").trim();
        const digitos = soDigitos(processo);
        if (!processo && !dossie) continue;
        if (digitos.length < 10) continue;
        linhas.push({ dossie, processo, processoDigitos: digitos, equipe });
      }

      if (linhas.length === 0) {
        toast.warning("Nenhuma linha válida encontrada na planilha.");
        await finalizarAuditoriaLote(auditId, {
          status: "concluida",
          resumo: "Nenhuma linha válida encontrada na planilha.",
        });
        setLoading(false);
        return;
      }

      setProgressLabel(`Buscando ${linhas.length} processos na base...`);

      // Busca por processo (valor original) em lotes; complementa com busca por dígitos via LIKE quando não achar.
      const encontradosPorDigitos = new Map<string, any>();
      const BATCH = 300;
      const numerosOriginais = [...new Set(linhas.map(l => l.processo).filter(Boolean))];

      for (let i = 0; i < numerosOriginais.length; i += BATCH) {
        const batch = numerosOriginais.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from("dados_benner")
          .select("id, processo, dossie, equipe, situacao_processo, data_distribuicao_real, data_distribuicao_planilha, status_distribuicao, em_analise, processo_outro_escritorio")
          .in("processo", batch);
        if (error) throw new Error(error.message);
        ((data as any[]) || []).forEach(row => {
          const dig = soDigitos(row.processo);
          if (dig && !encontradosPorDigitos.has(dig)) encontradosPorDigitos.set(dig, row);
        });
        setProgress(Math.round(((i + batch.length) / numerosOriginais.length) * 60));
      }

      // Fallback: buscar por dígitos os que não vieram (variações de formatação)
      const naoAchadosDigitos = linhas
        .map(l => l.processoDigitos)
        .filter(d => d && !encontradosPorDigitos.has(d));
      const naoAchadosUnicos = [...new Set(naoAchadosDigitos)];

      if (naoAchadosUnicos.length > 0) {
        setProgressLabel(`Fallback: buscando ${naoAchadosUnicos.length} números com variações...`);
        // Busca individual via OR (regexp_replace na coluna processo)
        // Aproximação simples: usa filtro `ilike` variantes é caro; melhor: consulta em lotes por `processo` textual não formatado, se houver.
        const SUB = 100;
        for (let i = 0; i < naoAchadosUnicos.length; i += SUB) {
          const batch = naoAchadosUnicos.slice(i, i + SUB);
          // usa or() com múltiplos ilike wildcarded
          const orClauses = batch.map(d => `processo.ilike.%${d}%`).join(",");
          const { data } = await supabase
            .from("dados_benner")
            .select("id, processo, dossie, equipe, situacao_processo, data_distribuicao_real, data_distribuicao_planilha, status_distribuicao, em_analise, processo_outro_escritorio")
            .or(orClauses)
            .limit(2000);
          ((data as any[]) || []).forEach(row => {
            const dig = soDigitos(row.processo);
            if (dig && !encontradosPorDigitos.has(dig)) encontradosPorDigitos.set(dig, row);
          });
          setProgress(60 + Math.round(((i + batch.length) / naoAchadosUnicos.length) * 20));
        }
      }

      // Carrega responsáveis
      const encontradosIds: string[] = [];
      encontradosPorDigitos.forEach(r => encontradosIds.push(r.id));
      setProgressLabel("Carregando responsáveis...");
      const respMap = encontradosIds.length > 0 ? await loadResponsaveisMap(encontradosIds) : new Map();
      setProgress(85);

      // Marca flag no banco
      let marcados = 0;
      if (marcarFlag && encontradosIds.length > 0) {
        setProgressLabel(`Marcando ${encontradosIds.length} processos como Outro Escritório...`);
        const UBATCH = 200;
        for (let i = 0; i < encontradosIds.length; i += UBATCH) {
          const batch = encontradosIds.slice(i, i + UBATCH);
          const { error, count } = await supabase
            .from("dados_benner")
            .update({ processo_outro_escritorio: true }, { count: "exact" })
            .in("id", batch);
          if (error) throw new Error(error.message);
          marcados += count ?? batch.length;
          setProgress(85 + Math.round(((i + batch.length) / encontradosIds.length) * 10));
        }
      }

      // Monta resultado
      const resultRows: LinhaResultado[] = linhas.map(l => {
        const r = encontradosPorDigitos.get(l.processoDigitos);
        if (!r) {
          return {
            dossie: l.dossie,
            processo: l.processo,
            equipe: l.equipe,
            encontrado: false,
            situacaoProcesso: "",
            dataDistribuicao: "",
            responsavel: "",
            emAnalise: "",
            statusEnvio: "",
            jaOutroEscritorio: false,
          };
        }
        const resps = respMap.get(r.id) || [];
        return {
          dossie: l.dossie,
          processo: l.processo,
          equipe: l.equipe,
          encontrado: true,
          situacaoProcesso: r.situacao_processo || "",
          dataDistribuicao: fmtDate(r.data_distribuicao_real || r.data_distribuicao_planilha),
          responsavel: resps.map((p: any) => p.nome).join(", "),
          emAnalise: r.em_analise ? "Sim" : "Não",
          statusEnvio: statusEnvioLabel(r.status_distribuicao),
          jaOutroEscritorio: !!r.processo_outro_escritorio,
        };
      });

      const encontrados = resultRows.filter(r => r.encontrado).length;
      setResultado(resultRows);
      setStats({
        total: resultRows.length,
        encontrados,
        naoEncontrados: resultRows.length - encontrados,
        marcados,
      });
      setProgress(100);
      setProgressLabel("Concluído");
      toast.success(`${encontrados} encontrados de ${resultRows.length} linhas.`);
      await finalizarAuditoriaLote(auditId, {
        status: "concluida",
        totalLinhas: resultRows.length,
        atualizados: marcados,
        ignorados: resultRows.length - encontrados,
        resumo: `${encontrados} encontrados de ${resultRows.length} linhas${marcarFlag ? ` · ${marcados} marcados como Outro Escritório` : " · sem marcação"}`,
        itens: resultRows.map((r) => ({
          processo: r.processo,
          dossie: r.dossie,
          acao: r.encontrado ? (marcarFlag ? "atualizado" : "encontrado") : "ignorado",
          detalhe: r.encontrado
            ? `${marcarFlag ? "Marcado como Outro Escritório · " : ""}Equipe: ${r.equipe || "—"} · Responsável: ${r.responsavel || "—"}`
            : "Não encontrado na base",
        })),
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar: " + (err?.message || String(err)));
      await finalizarAuditoriaLote(auditId, { status: "erro", erro: err?.message || String(err) });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const baixarRelatorio = () => {
    if (!resultado) return;
    const rows = resultado.map(r => ({
      "Dossiê": r.dossie,
      "Processo": r.processo,
      "Equipe": r.equipe,
      "Situação": r.encontrado ? "Encontrado (Outro Escritório)" : "Não encontrado",
      "Situação do Processo": r.situacaoProcesso,
      "Data Distribuição": r.dataDistribuicao,
      "Responsável": r.responsavel,
      "Em Análise": r.emAnalise,
      "Status Envio": r.statusEnvio,
      "Já Marcado Antes": r.encontrado ? (r.jaOutroEscritorio ? "Sim" : "Não") : "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: [
        "Dossiê",
        "Processo",
        "Equipe",
        "Situação",
        "Situação do Processo",
        "Data Distribuição",
        "Responsável",
        "Em Análise",
        "Status Envio",
        "Já Marcado Antes",
      ],
    });
    ws["!cols"] = [
      { wch: 24 }, { wch: 24 }, { wch: 34 }, { wch: 30 }, { wch: 28 },
      { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outro Escritório");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    XLSX.writeFile(wb, `relatorio-outro-escritorio-${ts}.xlsx`);
  };

  return (
    <MainLayout title="Verificação Outro Escritório">
      <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Importar planilha de migração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Formato esperado: colunas <strong>Identificador Dossiê</strong>, <strong>Processo</strong> e <strong>Equipe</strong> (cabeçalho na primeira linha). O sistema busca cada processo em <em>Dados Benner</em>, marca os encontrados como <strong>Outro Escritório</strong> e gera um relatório em Excel.
            </p>

            <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
              <Switch id="marcar" checked={marcarFlag} onCheckedChange={setMarcarFlag} disabled={loading} />
              <Label htmlFor="marcar" className="cursor-pointer">
                Marcar processos encontrados como <strong>Outro Escritório</strong> (dados_benner.processo_outro_escritorio = true)
              </Label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && processar(e.target.files[0])}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {loading ? "Processando..." : "Selecionar planilha"}
              </Button>
              {resultado && (
                <Button variant="outline" onClick={baixarRelatorio}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar relatório Excel
                </Button>
              )}
            </div>

            {loading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{progressLabel}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {resultado && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold">{stats.total}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Encontrados</div><div className="text-2xl font-semibold text-emerald-500">{stats.encontrados}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Não encontrados</div><div className="text-2xl font-semibold text-amber-500">{stats.naoEncontrados}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Marcados como Outro Escritório</div><div className="text-2xl font-semibold text-sky-400">{stats.marcados}</div></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Resultado</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[600px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="text-left p-2">Dossiê</th>
                        <th className="text-left p-2">Processo</th>
                        <th className="text-left p-2">Equipe</th>
                        <th className="text-left p-2">Situação</th>
                        <th className="text-left p-2">Situação do Processo</th>
                        <th className="text-left p-2">Distribuição</th>
                        <th className="text-left p-2">Responsável</th>
                        <th className="text-left p-2">Em Análise</th>
                        <th className="text-left p-2">Status Envio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.map((r, i) => (
                        <tr key={i} className="border-t hover:bg-muted/40">
                          <td className="p-2">{r.dossie}</td>
                          <td className="p-2 font-mono text-xs">{r.processo}</td>
                          <td className="p-2">{r.equipe}</td>
                          <td className={"p-2 " + (r.encontrado ? "text-emerald-500" : "text-amber-500")}>
                            {r.encontrado ? "Outro Escritório" : "Não encontrado"}
                          </td>
                          <td className="p-2">{r.situacaoProcesso}</td>
                          <td className="p-2">{r.dataDistribuicao}</td>
                          <td className="p-2">{r.responsavel}</td>
                          <td className="p-2">{r.emAnalise}</td>
                          <td className="p-2">{r.statusEnvio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}