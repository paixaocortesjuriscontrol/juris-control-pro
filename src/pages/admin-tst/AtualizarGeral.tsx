import { useState } from "react";
import * as XLSX from "xlsx";
import { MainLayout } from "@/components/layout/MainLayout";
import { VoltarAdminTstButton } from "@/components/admin-tst/VoltarAdminTstButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { iniciarAuditoriaLote, finalizarAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";

const COORD_RENATA = "b0f690ad-68da-43d7-af5f-9adafeab3fd5";

type LinhaPlanilha = Record<string, any> & { _digits: string; _processo: string; _dossie: string };
type BaseRow = {
  id: string; processo: string; dossie: string | null; equipe: string | null; coordenacao_id: string | null;
  turma: string | null; relator: string | null; recorrente: string | null; status: string | null;
  situacao_envio: string | null; benner_atualizado: boolean | null; pronto: boolean | null;
  data_distribuicao_real: string | null; reclamante: string | null; reclamada: string | null;
  responsaveis?: string;
};

const fmtData = (v: string | null) => {
  if (!v) return "";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
};

function linhaArquivar(a: BaseRow) {
  return {
    Processo: a.processo,
    "Dossiê": a.dossie || "",
    Equipe: a.equipe || "",
    Turma: a.turma || "",
    Relator: a.relator || "",
    Recorrente: a.recorrente || "",
    "Pronto para distribuir": a.pronto ? "SIM" : "NÃO",
    "Benner atualizado": a.benner_atualizado ? "SIM" : "NÃO",
    "Situação de envio": a.situacao_envio || "",
    Status: a.status || "",
    "Data de distribuição": fmtData(a.data_distribuicao_real),
    Reclamante: a.reclamante || "",
    Reclamada: a.reclamada || "",
    "Responsável(is)": a.responsaveis || "",
    "Coordenação": a.coordenacao_id ? "Dra. Renata Oficial" : "Sem coordenação",
  };
}

const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const txt = (v: unknown) => String(v ?? "").replace(/^'/, "").trim();
const fmtCnj = (d: string) =>
  d.length === 20 ? `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}` : d;
const dossieValido = (v: string) => /^\d{2}\.\d{2}\.\d{3}\.\d{6,12}\/\d{2}$/.test(v);

function dataIso(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const m = txt(v).split(/[\sT]/)[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

const col = (r: Record<string, any>, nome: string) => {
  const alvo = nome.toLowerCase();
  const k = Object.keys(r).find((c) => c.trim().toLowerCase() === alvo);
  return k ? txt(r[k]) : "";
};

function baixar(nome: string, linhas: Record<string, any>[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ Aviso: "Nenhum item" }]), "Lista");
  XLSX.writeFile(wb, nome);
}

export default function AtualizarGeral() {
  const { user } = useAuth();
  const { isAdmin, loading: carregandoPerfil } = useUserRole();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [etapa, setEtapa] = useState("");
  const [novos, setNovos] = useState<LinhaPlanilha[]>([]);
  const [arquivar, setArquivar] = useState<BaseRow[]>([]);
  const [mantidos, setMantidos] = useState(0);
  const [totalPlanilha, setTotalPlanilha] = useState(0);
  const [totalBase, setTotalBase] = useState(0);
  const [analisado, setAnalisado] = useState(false);
  const [resultado, setResultado] = useState<{ cadastrados: number; arquivados: number; erros: { processo: string; erro: string }[] } | null>(null);

  if (!carregandoPerfil && !isAdmin) {
    return (
      <MainLayout title="Atualizar Geral">
        <div className="p-6">Somente administradores podem usar esta tela.</div>
      </MainLayout>
    );
  }

  const analisar = async () => {
    if (!arquivo) return;
    setAnalisando(true);
    setResultado(null);
    setAnalisado(false);
    try {
      setEtapa("Lendo a planilha...");
      const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array", cellDates: true });
      const linhas: LinhaPlanilha[] = [];
      for (const nome of wb.SheetNames) {
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[nome], { defval: "" });
        for (const r of json) {
          const d = digitos(col(r, "Processo"));
          if (d.length !== 20) continue;
          linhas.push({ ...r, _digits: d, _processo: fmtCnj(d), _dossie: col(r, "Dossiê") });
        }
      }
      setTotalPlanilha(linhas.length);

      setEtapa("Carregando a base da Distribuição TST...");
      const base: BaseRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase.from("dados_benner") as any)
          .select("id, processo, dossie, equipe, coordenacao_id, turma, relator, recorrente, status, situacao_envio, benner_atualizado, pronto, data_distribuicao_real, reclamante, reclamada")
          .not("aba_origem", "is", null)
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        base.push(...(data || []));
        setEtapa(`Carregando a base... ${base.length}`);
        if (!data || data.length < 1000) break;
      }
      setTotalBase(base.length);

      setEtapa("Carregando responsáveis...");
      const nomesPorId = new Map<string, string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase.from("dados_benner_responsaveis") as any)
          .select("dados_benner_id, profiles:responsavel_id(full_name)")
          .range(from, from + 999);
        if (error) break;
        for (const r of data || []) {
          const nome = (r as any).profiles?.full_name;
          if (!nome) continue;
          const k = (r as any).dados_benner_id;
          nomesPorId.set(k, nomesPorId.has(k) ? `${nomesPorId.get(k)}, ${nome}` : nome);
        }
        if (!data || data.length < 1000) break;
      }
      for (const b of base) b.responsaveis = nomesPorId.get(b.id) || "";

      const chavesPlanilha = new Set(linhas.map((l) => `${l._digits}|${l._dossie}`));
      const digitsPlanilha = new Set(linhas.map((l) => l._digits));
      const chavesBase = new Set<string>();
      const baseSemDossie = new Set<string>();
      const arq: BaseRow[] = [];
      let mant = 0;
      for (const b of base) {
        const d = digitos(b.processo);
        const dos = (b.dossie || "").trim();
        chavesBase.add(`${d}|${dos}`);
        if (!dos) baseSemDossie.add(d);
        const fica = dos ? chavesPlanilha.has(`${d}|${dos}`) : digitsPlanilha.has(d);
        if (fica) mant++;
        else arq.push(b);
      }
      const vistos = new Set<string>();
      const nov = linhas.filter((l) => {
        const k = `${l._digits}|${l._dossie}`;
        if (vistos.has(k)) return false;
        vistos.add(k);
        return !chavesBase.has(k) && !baseSemDossie.has(l._digits);
      });
      setNovos(nov);
      setArquivar(arq);
      setMantidos(mant);
      setAnalisado(true);
    } catch (e: any) {
      toast.error("Erro ao analisar: " + (e?.message || e));
    } finally {
      setAnalisando(false);
      setEtapa("");
    }
  };

  const confirmar = async () => {
    if (!user) return;
    const msg = `Confirmar Atualizar Geral?\n\n• ${novos.length} processo(s) novo(s) serão cadastrados\n• ${arquivar.length} processo(s) serão arquivados\n\nOs arquivados podem ser restaurados na tela Arquivados.`;
    if (!window.confirm(msg)) return;
    if (totalPlanilha < totalBase / 2) {
      if (!window.confirm(`ATENÇÃO: a planilha tem ${totalPlanilha} linhas e a base tem ${totalBase}. Isso vai arquivar mais da metade da base. Tem certeza?`)) return;
    }
    setGravando(true);
    setProgresso(0);
    const erros: { processo: string; erro: string }[] = [];
    let cadastrados = 0;
    let arquivados = 0;
    const total = novos.length + arquivar.length || 1;
    const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const auditId = await iniciarAuditoriaLote({
      tipo: "atualizar_geral",
      ferramenta: "Atualizar Geral",
      arquivoNome: arquivo?.name,
      coordenacaoId: COORD_RENATA,
      totalLinhas: totalPlanilha,
    });
    try {
      setEtapa("Cadastrando processos novos...");
      for (let i = 0; i < novos.length; i += 200) {
        const lote = novos.slice(i, i + 200).map((r) => {
          const dt = dataIso(r[Object.keys(r).find((k) => k.toLowerCase().startsWith("data da distribui")) || ""]);
          return {
            processo: r._processo,
            tribunal: "TST",
            aba_origem: "Atualizar Geral",
            dossie: dossieValido(r._dossie) ? r._dossie : null,
            equipe: col(r, "Equipe") || null,
            turma: col(r, "Turma") || null,
            relator: col(r, "Relator") || null,
            recorrente: col(r, "Recorrente") || null,
            data_distribuicao_planilha: dt,
            data_distribuicao_real: dt,
            status: "rascunho",
            user_id: user.id,
            coordenacao_id: COORD_RENATA,
            fontes_importacao: ["Atualizar Geral"],
          };
        });
        const { error } = await (supabase.from("dados_benner") as any).insert(lote);
        if (error) lote.forEach((l) => erros.push({ processo: l.processo, erro: error.message }));
        else cadastrados += lote.length;
        setProgresso(Math.round(((i + lote.length) / total) * 100));
      }

      setEtapa("Arquivando processos ausentes na planilha...");
      const motivo = `Ausente na Base Módulo TST de ${hoje}`;
      for (let i = 0; i < arquivar.length; i += 50) {
        const lote = arquivar.slice(i, i + 50);
        for (let j = 0; j < lote.length; j += 4) {
          await Promise.all(
            lote.slice(j, j + 4).map(async (b) => {
              const { error } = await (supabase.rpc as any)("arquivar_dados_benner", { _id: b.id, _motivo: motivo });
              if (error) erros.push({ processo: b.processo, erro: error.message });
              else arquivados++;
            }),
          );
        }
        setProgresso(Math.round(((novos.length + i + lote.length) / total) * 100));
      }
      setResultado({ cadastrados, arquivados, erros });
      await finalizarAuditoriaLote(auditId, {
        status: "concluida",
        totalLinhas: totalPlanilha,
        criados: cadastrados,
        atualizados: arquivados,
        erros: erros.length,
        resumo: `${cadastrados} cadastrados, ${arquivados} arquivados, ${erros.length} erros`,
        itens: [
          ...novos.map((n) => ({ processo: n._processo, dossie: n._dossie, acao: "criado" })),
          ...arquivar.map((a) => ({ processo: a.processo, dossie: a.dossie, acao: "arquivado" })),
        ],
      });
      toast.success(`Concluído: ${cadastrados} cadastrados, ${arquivados} arquivados.`);
      setAnalisado(false);
    } catch (e: any) {
      await finalizarAuditoriaLote(auditId, { status: "erro", erro: e?.message, criados: cadastrados, atualizados: arquivados });
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setGravando(false);
      setEtapa("");
    }
  };

  return (
    <MainLayout title="Atualizar Geral">
      <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
        <VoltarAdminTstButton />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atualizar Geral</CardTitle>
            <CardDescription>
              Compara a planilha "Base Módulo TST" com a base da Distribuição TST: cadastra os processos novos e arquiva
              os que estão na base e não estão na planilha. Nada é gravado antes da sua confirmação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Selecione a planilha (.xlsx) com as colunas "Processo" e "Dossiê".</li>
              <li>Clique em Analisar e confira as listas (pode baixar cada uma em Excel).</li>
              <li>Confirme para cadastrar os novos e arquivar os ausentes. Arquivados podem ser restaurados em "Arquivados".</li>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="file" accept=".xlsx,.xls" className="max-w-sm" onChange={(e) => { setArquivo(e.target.files?.[0] || null); setAnalisado(false); setResultado(null); }} />
              <Button onClick={analisar} disabled={!arquivo || analisando || gravando}>
                {analisando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Analisar
              </Button>
            </div>
            {etapa && <p className="text-sm text-muted-foreground">{etapa}</p>}
            {gravando && <Progress value={progresso} />}
          </CardContent>
        </Card>

        {analisado && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conferência</CardTitle>
              <CardDescription>
                Planilha: {totalPlanilha} linhas válidas · Base: {totalBase} fichas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border p-3">
                  <div className="text-sm text-muted-foreground">Novos (serão cadastrados)</div>
                  <div className="text-2xl font-semibold">{novos.length}</div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => baixar("Novos_Atualizar_Geral.xlsx", novos.map((n) => ({ Processo: n._processo, Dossiê: n._dossie, Equipe: col(n, "Equipe"), Turma: col(n, "Turma"), Relator: col(n, "Relator") })))}>
                    <Download className="w-4 h-4 mr-1" /> Excel
                  </Button>
                </div>
                <div className="rounded-md border border-destructive/40 p-3">
                  <div className="text-sm text-muted-foreground">Arquivar (fora da planilha)</div>
                  <div className="text-2xl font-semibold text-destructive">{arquivar.length}</div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => baixar("Arquivar_Atualizar_Geral.xlsx", arquivar.map(linhaArquivar))}>
                    <Download className="w-4 h-4 mr-1" /> Excel
                  </Button>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-sm text-muted-foreground">Mantidos (sem alteração)</div>
                  <div className="text-2xl font-semibold">{mantidos}</div>
                </div>
              </div>
              {totalPlanilha < totalBase / 2 && (
                <Badge variant="destructive">A planilha tem menos da metade do tamanho da base. Confira antes de confirmar.</Badge>
              )}
              <Button onClick={confirmar} disabled={gravando || (novos.length === 0 && arquivar.length === 0)}>
                {gravando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar e gravar
              </Button>
            </CardContent>
          </Card>
        )}

        {resultado && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resultado</CardTitle>
              <CardDescription>
                {resultado.cadastrados} cadastrados · {resultado.arquivados} arquivados · {resultado.erros.length} erros
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => baixar("Relatorio_Atualizar_Geral.xlsx", [
                ...novos.map((n) => ({ Ação: "Cadastrado", Processo: n._processo, Dossiê: n._dossie, Erro: "" })),
                ...arquivar.map((a) => ({ Ação: "Arquivado", ...linhaArquivar(a), Erro: "" })),
                ...resultado.erros.map((e) => ({ Ação: "Erro", Processo: e.processo, Dossiê: "", Erro: e.erro })),
              ])}>
                <Download className="w-4 h-4 mr-2" /> Baixar relatório
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
