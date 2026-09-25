import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Download, Loader2, Plus, Sparkles, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { extrairCamposDoJuditRaw, extrairPartesDoJuditRaw } from "@/lib/juditRawCampos";

type Coord = { id: string; nome: string };
const digitos = (s: string) => (s || "").replace(/\D/g, "");
const formatarCnj = (s: string) => {
  const d = digitos(s);
  if (d.length !== 20) return s.trim();
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
};

async function localizarProcesso(numero: string): Promise<{ id: string; numero: string } | null> {
  const d = digitos(numero);
  const { data } = await (supabase.rpc as any)("buscar_processos_global", { _termo: numero, _limite: 20 });
  const lista = (data as any[]) || [];
  const achado = lista.find((p) => digitos(p.numero) === d) || null;
  return achado ? { id: achado.id, numero: achado.numero } : null;
}

async function ativarAcompanhamento(id: string, freq: number, anexos: boolean) {
  const { data, error } = await supabase
    .from("processos")
    .update({
      acompanhamento_especial: true,
      acompanhamento_ativado_em: new Date().toISOString(),
      acompanhamento_freq_diaria: freq,
      acompanhamento_com_anexos: anexos,
    } as any)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Sem permissão para alterar este processo.");
}

/** Cria o processo e preenche com a Judit (mesma consulta do botão Judit de Processos e Casos). */
async function criarProcessoComJudit(numero: string, coordenacaoId: string, uid: string | null) {
  const numeroFmt = formatarCnj(numero);
  let campos: Record<string, any> = {};
  let raw: any = null;
  let juditOk = false;
  try {
    const { data, error } = await supabase.functions.invoke("busca-judit-processos-e-casos", {
      body: { numero_processo: numeroFmt, with_attachments: false, force_refresh: false },
    });
    if (!error && data && !(data as any).error) {
      raw = data;
      juditOk = true;
      campos = extrairCamposDoJuditRaw(data);
      const partes = extrairPartesDoJuditRaw(data).filter((p) => !p.is_advogado);
      const ativos = [...new Set(partes.filter((p) => p.lado_efetivo === "ACTIVE").map((p) => p.nome))];
      const passivos = [...new Set(partes.filter((p) => p.lado_efetivo === "PASSIVE").map((p) => p.nome))];
      if (ativos.length) { campos.polo_ativo = ativos.join(" / "); campos.autor = ativos.join(" / "); }
      if (passivos.length) campos.polo_passivo = passivos.join(" / ");
    }
  } catch (e) {
    console.warn("Judit falhou:", e);
  }
  delete campos.status; // enum próprio do sistema
  const payload: any = {
    ...campos,
    numero: numeroFmt,
    coordenacao_id: coordenacaoId,
    area: campos.area || "trabalhista",
    judit_campos: Object.keys(campos),
  };
  const { data: novo, error } = await supabase.from("processos").insert(payload).select("id, numero").single();
  if (error) throw error;
  if (raw) {
    await supabase.from("consultas_judit").insert({
      processo_id: novo.id, requisitada_em: new Date().toISOString(), status_http: 200, payload_resposta: raw, erro: null,
    } as any);
    try {
      await supabase.from("judit_logs" as any).insert({
        processo_numero: numeroFmt, tribunal: raw?.tribunal || null,
        request_payload: { numero_processo: numeroFmt, fonte: "busca-judit-processos-e-casos", origem: "monitoramento" },
        raw_response: raw, status: "sucesso", error_message: null, created_by: uid,
      });
    } catch { /* noop */ }
  }
  return { id: novo.id as string, numero: novo.numero as string, juditOk, qtdCampos: Object.keys(campos).length };
}

type ResultadoLote = { numero: string; resultado: string; ok: boolean };
type StatusProgresso = "processando" | "aguardando" | "sucesso" | "erro";
type ProgressoIndividual = {
  percentual: number;
  etapa: string;
  detalhe: string;
  status: StatusProgresso;
};
type ProgressoLote = {
  feito: number;
  total: number;
  percentual: number;
  numeroAtual: string;
  etapa: string;
  sucessos: number;
  erros: number;
};

export function CadastroAcompanhamentoEspecial() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [numero, setNumero] = useState("");
  const [freq, setFreq] = useState(1);
  const [anexos, setAnexos] = useState(false);
  const [coordId, setCoordId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [perguntarCriar, setPerguntarCriar] = useState(false);
  const [progressoIndividual, setProgressoIndividual] = useState<ProgressoIndividual | null>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loteCoordId, setLoteCoordId] = useState("");
  const [loteCriar, setLoteCriar] = useState(true);
  const [progresso, setProgresso] = useState<ProgressoLote>({
    feito: 0,
    total: 0,
    percentual: 0,
    numeroAtual: "",
    etapa: "",
    sucessos: 0,
    erros: 0,
  });
  const [processandoLote, setProcessandoLote] = useState(false);
  const [resultados, setResultados] = useState<ResultadoLote[]>([]);

  useEffect(() => {
    if (!open || coords.length) return;
    supabase.from("coordenacoes").select("id, nome").order("nome").then(({ data }) => setCoords((data as any) || []));
  }, [open, coords.length]);

  const atualizarTela = async () => {
    await qc.invalidateQueries();
  };

  const handleCadastrar = async () => {
    if (salvando) return;
    if (digitos(numero).length < 15) { toast.warning("Digite um número de processo válido."); return; }
    const numeroExibicao = formatarCnj(numero);
    setProgressoIndividual({
      percentual: 15,
      etapa: "Procurando processo",
      detalhe: `Consultando ${numeroExibicao} na base do escritório.`,
      status: "processando",
    });
    setSalvando(true);
    try {
      const p = await localizarProcesso(numero);
      if (!p) {
        setProgressoIndividual({
          percentual: 25,
          etapa: "Processo não encontrado",
          detalhe: "Aguardando a confirmação para cadastrar e consultar a Judit.",
          status: "aguardando",
        });
        setPerguntarCriar(true);
        return;
      }
      setProgressoIndividual({
        percentual: 65,
        etapa: "Ativando acompanhamento",
        detalhe: `Aplicando as configurações em ${p.numero}.`,
        status: "processando",
      });
      await ativarAcompanhamento(p.id, freq, anexos);
      setProgressoIndividual({
        percentual: 90,
        etapa: "Atualizando a tela",
        detalhe: "Sincronizando os dados do monitoramento.",
        status: "processando",
      });
      await atualizarTela();
      setProgressoIndividual({
        percentual: 100,
        etapa: "Acompanhamento ativado",
        detalhe: `${p.numero} já está no Acompanhamento Especial.`,
        status: "sucesso",
      });
      toast.success(`Acompanhamento especial ativado em ${p.numero}.`);
      setNumero("");
    } catch (e: any) {
      setProgressoIndividual({
        percentual: 100,
        etapa: "Não foi possível concluir",
        detalhe: e?.message || "Erro ao cadastrar acompanhamento.",
        status: "erro",
      });
      toast.error(e?.message || "Erro ao cadastrar acompanhamento.");
    } finally {
      setSalvando(false);
    }
  };

  const handleCriar = async () => {
    if (!coordId) { toast.warning("Escolha a coordenação."); return; }
    setPerguntarCriar(false);
    setSalvando(true);
    setProgressoIndividual({
      percentual: 35,
      etapa: "Consultando a Judit",
      detalhe: `Buscando informações de ${formatarCnj(numero)}. Esta etapa pode levar alguns instantes.`,
      status: "processando",
    });
    try {
      const { data: u } = await supabase.auth.getUser();
      const novo = await criarProcessoComJudit(numero, coordId, u?.user?.id || null);
      setProgressoIndividual({
        percentual: 72,
        etapa: "Ativando acompanhamento",
        detalhe: novo.juditOk
          ? `${novo.qtdCampos} informação(ões) recebida(s) da Judit. Ativando o monitoramento.`
          : "Processo cadastrado sem dados da Judit. Ativando o monitoramento.",
        status: "processando",
      });
      await ativarAcompanhamento(novo.id, freq, anexos);
      setProgressoIndividual({
        percentual: 90,
        etapa: "Atualizando a tela",
        detalhe: "Sincronizando os dados do monitoramento.",
        status: "processando",
      });
      await atualizarTela();
      setProgressoIndividual({
        percentual: 100,
        etapa: "Cadastro concluído",
        detalhe: novo.juditOk
          ? `${novo.numero} foi cadastrado com dados da Judit e já está sendo acompanhado.`
          : `${novo.numero} foi cadastrado e já está sendo acompanhado. A Judit não retornou dados.`,
        status: "sucesso",
      });
      toast.success(
        novo.juditOk
          ? `Processo ${novo.numero} cadastrado com ${novo.qtdCampos} informação(ões) da Judit e acompanhamento ativado.`
          : `Processo ${novo.numero} cadastrado e acompanhamento ativado. A Judit não trouxe dados.`,
      );
      setNumero("");
    } catch (e: any) {
      setProgressoIndividual({
        percentual: 100,
        etapa: "Não foi possível concluir",
        detalhe: e?.message || "Erro ao cadastrar o processo.",
        status: "erro",
      });
      toast.error(e?.message || "Erro ao cadastrar o processo.");
    } finally {
      setSalvando(false);
    }
  };

  const baixarModelo = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Processo", "Coordenação", "Vezes ao dia"],
      ["0000000-00.2024.5.02.0001", "", 1],
    ]);
    ws["!cols"] = [{ wch: 28 }, { wch: 40 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Acompanhamento");
    XLSX.writeFile(wb, "modelo_acompanhamento_especial.xlsx");
  };

  const processarLote = async () => {
    if (!arquivo) { toast.warning("Selecione a planilha."); return; }
    setProcessandoLote(true);
    setResultados([]);
    setProgresso({ feito: 0, total: 0, percentual: 0, numeroAtual: "", etapa: "Lendo a planilha", sucessos: 0, erros: 0 });
    try {
      const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
      const linhas: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const pegar = (l: any, ...nomes: string[]) => {
        const k = Object.keys(l).find((c) => nomes.some((n) => norm(c).includes(n)));
        return k ? String(l[k] ?? "").trim() : "";
      };
      const itens = linhas
        .map((l) => ({
          numero: pegar(l, "processo", "numero", "cnj"),
          coord: pegar(l, "coordenac"),
          freq: Math.max(1, Math.min(3, parseInt(pegar(l, "vezes", "frequen")) || 1)),
          anexos: /^(s|sim|x|1|true)/i.test(pegar(l, "anexo")),
        }))
        .filter((i) => digitos(i.numero).length >= 15);
      const vistos = new Set<string>();
      const unicos = itens.filter((i) => { const d = digitos(i.numero); if (vistos.has(d)) return false; vistos.add(d); return true; });
      if (!unicos.length) { toast.warning("Nenhum número de processo encontrado na planilha."); return; }

      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id || null;
      setProgresso({
        feito: 0,
        total: unicos.length,
        percentual: 0,
        numeroAtual: formatarCnj(unicos[0]?.numero || ""),
        etapa: "Preparando o lote",
        sucessos: 0,
        erros: 0,
      });
      const res: ResultadoLote[] = [];
      for (const [idx, it] of unicos.entries()) {
        const atualizarProgressoLote = (etapa: string, fracao: number) => {
          const sucessos = res.filter((r) => r.ok).length;
          const erros = res.length - sucessos;
          setProgresso({
            feito: idx,
            total: unicos.length,
            percentual: ((idx + fracao) / unicos.length) * 100,
            numeroAtual: formatarCnj(it.numero),
            etapa,
            sucessos,
            erros,
          });
        };
        try {
          atualizarProgressoLote("Procurando processo na base", 0.15);
          const p = await localizarProcesso(it.numero);
          if (p) {
            atualizarProgressoLote("Ativando acompanhamento", 0.65);
            await ativarAcompanhamento(p.id, it.freq, it.anexos);
            res.push({ numero: p.numero, resultado: "Acompanhamento ativado", ok: true });
          } else if (!loteCriar) {
            res.push({ numero: it.numero, resultado: "Não existe na base — ignorado", ok: false });
          } else {
            const c = it.coord ? coords.find((x) => norm(x.nome) === norm(it.coord) || norm(x.nome).includes(norm(it.coord))) : null;
            const cid = c?.id || loteCoordId;
            if (!cid) {
              res.push({ numero: it.numero, resultado: "Coordenação não informada ou não encontrada", ok: false });
            } else {
              atualizarProgressoLote("Consultando e preenchendo pela Judit", 0.35);
              const novo = await criarProcessoComJudit(it.numero, cid, uid);
              atualizarProgressoLote("Ativando acompanhamento", 0.75);
              await ativarAcompanhamento(novo.id, it.freq, it.anexos);
              res.push({
                numero: novo.numero,
                resultado: novo.juditOk ? `Cadastrado com Judit (${novo.qtdCampos} campos) e ativado` : "Cadastrado sem dados da Judit e ativado",
                ok: true,
              });
            }
          }
        } catch (e: any) {
          res.push({ numero: it.numero, resultado: `Erro: ${e?.message || e}`, ok: false });
        }
        const sucessos = res.filter((r) => r.ok).length;
        const erros = res.length - sucessos;
        setProgresso({
          feito: idx + 1,
          total: unicos.length,
          percentual: ((idx + 1) / unicos.length) * 100,
          numeroAtual: formatarCnj(it.numero),
          etapa: idx + 1 === unicos.length ? "Finalizando e atualizando a tela" : "Processo concluído",
          sucessos,
          erros,
        });
        setResultados([...res]);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      await atualizarTela();
      const ok = res.filter((r) => r.ok).length;
      setProgresso({
        feito: res.length,
        total: res.length,
        percentual: 100,
        numeroAtual: "",
        etapa: "Lote concluído",
        sucessos: ok,
        erros: res.length - ok,
      });
      toast.success(`Lote concluído: ${ok} de ${res.length} processo(s) com acompanhamento ativado.`);
    } catch (e: any) {
      setProgresso((atual) => ({ ...atual, etapa: e?.message || "Erro ao ler a planilha" }));
      toast.error(e?.message || "Erro ao ler a planilha.");
    } finally {
      setProcessandoLote(false);
    }
  };

  const exportarResultado = () => {
    const ws = XLSX.utils.json_to_sheet(resultados.map((r) => ({ Processo: r.numero, Resultado: r.resultado })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    XLSX.writeFile(wb, "resultado_acompanhamento_especial.xlsx");
  };

  const SelectCoord = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Escolha a coordenação" /></SelectTrigger>
      <SelectContent>
        {coords.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-2" /> Cadastrar acompanhamento
      </Button>
      <Sheet open={open} onOpenChange={(v) => !processandoLote && !salvando && setOpen(v)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Acompanhamento Especial</SheetTitle>
            <SheetDescription>Cadastre um processo ou vários de uma vez por planilha Excel.</SheetDescription>
          </SheetHeader>
          <Tabs defaultValue="individual" className="mt-4">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="individual" disabled={salvando || processandoLote}>Um processo</TabsTrigger>
              <TabsTrigger value="lote" disabled={salvando || processandoLote}>Em lote (Excel)</TabsTrigger>
            </TabsList>

            <TabsContent value="individual" className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label>Número do processo</Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Com ou sem pontuação"
                  disabled={salvando} onKeyDown={(e) => e.key === "Enter" && !salvando && handleCadastrar()} />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>Vezes ao dia</Label>
                  <Input type="number" min={1} max={3} value={freq} className="w-16 h-8"
                    onChange={(e) => setFreq(Math.max(1, Math.min(3, Number(e.target.value) || 1)))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Horários BRT: 1x=10h, 2x=10h/18h, 3x=10h/14h/18h. Cada checagem consome créditos Judit.</p>
              <Button onClick={handleCadastrar} disabled={salvando} className="w-full">
                {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Cadastrar acompanhamento
              </Button>
              {progressoIndividual && (
                <div
                  className={`space-y-3 rounded-md border p-3 ${
                    progressoIndividual.status === "erro" ? "border-destructive/40 bg-destructive/5" : "bg-muted/30"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-2">
                    {progressoIndividual.status === "processando" ? (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : progressoIndividual.status === "sucesso" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    ) : progressoIndividual.status === "erro" ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    ) : (
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{progressoIndividual.etapa}</p>
                        <span className="text-xs tabular-nums text-muted-foreground">{progressoIndividual.percentual}%</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{progressoIndividual.detalhe}</p>
                    </div>
                  </div>
                  <Progress value={progressoIndividual.percentual} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="lote" className="space-y-4 pt-4">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p>Colunas da planilha: <b>Processo</b> (obrigatória), <b>Coordenação</b> e <b>Vezes ao dia</b> (1 a 3).</p>
                <p>Processos que não existem na base são cadastrados na coordenação da linha (ou na coordenação padrão abaixo) e preenchidos pela Judit.</p>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={baixarModelo}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Baixar planilha modelo
                </Button>
              </div>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
              <div className="flex items-center gap-2">
                <Switch checked={loteCriar} onCheckedChange={setLoteCriar} />
                <Label>Cadastrar processos que não existem (com Judit)</Label>
              </div>
              {loteCriar && (
                <div className="space-y-1">
                  <Label>Coordenação padrão (quando a linha não informar)</Label>
                  <SelectCoord value={loteCoordId} onChange={setLoteCoordId} />
                </div>
              )}
              <Button onClick={processarLote} disabled={processandoLote || !arquivo} className="w-full">
                {processandoLote ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Processar planilha
              </Button>
              {progresso.total > 0 && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-3" role="status" aria-live="polite">
                  <div className="flex items-start gap-2">
                    {processandoLote ? (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{progresso.etapa}</p>
                        <span className="text-xs tabular-nums text-muted-foreground">{Math.round(progresso.percentual)}%</span>
                      </div>
                      {progresso.numeroAtual && (
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{progresso.numeroAtual}</p>
                      )}
                    </div>
                  </div>
                  <Progress value={progresso.percentual} />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{progresso.feito} de {progresso.total} concluído(s)</span>
                    <span>{progresso.sucessos} sucesso(s) · {progresso.erros} erro(s)</span>
                  </div>
                </div>
              )}
              {resultados.length > 0 && (
                <div className="space-y-2">
                  <div className="max-h-72 overflow-y-auto rounded-md border border-border text-xs">
                    {resultados.map((r, i) => (
                      <div key={i} className="flex justify-between gap-2 border-b border-border px-2 py-1 last:border-0">
                        <span className="font-mono">{r.numero}</span>
                        <span className={r.ok ? "text-primary" : "text-destructive"}>{r.resultado}</span>
                      </div>
                    ))}
                  </div>
                  {!processandoLote && (
                    <Button variant="outline" size="sm" onClick={exportarResultado}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Exportar resultado
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AlertDialog open={perguntarCriar} onOpenChange={setPerguntarCriar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Processo não encontrado</AlertDialogTitle>
            <AlertDialogDescription>
              O processo {formatarCnj(numero)} não está cadastrado. Deseja cadastrá-lo? A Judit vai preencher o máximo de informações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label>Coordenação</Label>
            <SelectCoord value={coordId} onChange={setCoordId} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleCriar(); }} disabled={!coordId}>
              Sim, cadastrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
