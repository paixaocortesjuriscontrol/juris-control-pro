import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Download, Loader2, Play, X, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  parsePlanilhaProcessos,
  gerarRelatorioBuscaPublicacao,
  type ProcessoBusca,
  type ResultadoBusca,
} from "@/lib/buscaPublicacaoExcel";

// Lista de tribunais suportados pelo DJEN — igual ao MonitoramentoDialog.
const TRIBUNAIS: { id: string; nome: string; grupo: "Estadual" | "Federal" | "Superior" | "Trabalhista" }[] = [
  ...["TJAC","TJAL","TJAM","TJAP","TJBA","TJCE","TJDFT","TJES","TJGO","TJMA","TJMG","TJMS","TJMT","TJPA","TJPB","TJPE","TJPI","TJPR","TJRJ","TJRN","TJRO","TJRR","TJRS","TJSC","TJSE","TJSP","TJTO"].map((id) => ({ id, nome: id, grupo: "Estadual" as const })),
  ...["TRF1","TRF2","TRF3","TRF4","TRF5","TRF6"].map((id) => ({ id, nome: id, grupo: "Federal" as const })),
  { id: "STJ", nome: "STJ", grupo: "Superior" },
  { id: "STF", nome: "STF", grupo: "Superior" },
  { id: "TST", nome: "TST", grupo: "Trabalhista" },
  ...Array.from({ length: 24 }, (_, i) => ({ id: `TRT${i + 1}`, nome: `TRT${i + 1}`, grupo: "Trabalhista" as const })),
];

const GRUPOS: Array<"Trabalhista" | "Superior" | "Federal" | "Estadual"> = ["Trabalhista", "Superior", "Federal", "Estadual"];

const TIPO = "busca_publicacao_servidor";

export default function BuscaPublicacao() {
  const [processos, setProcessos] = useState<ProcessoBusca[]>([]);
  const [fileName, setFileName] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tribunais, setTribunais] = useState<string[]>(["TST"]);
  const [execucaoId, setExecucaoId] = useState<string | null>(null);
  const [execucao, setExecucao] = useState<any | null>(null);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [starting, setStarting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalProcessos = processos.length;
  const invalidos = useMemo(() => processos.filter((p) => !p.valido).length, [processos]);

  const status = execucao?.status || null;
  const progresso = execucao?.progresso || null;
  const processados = Number(progresso?.processados || 0);
  const totalPubl = Number(progresso?.total_publicacoes || 0);
  const totalProcExec = Number(progresso?.total_processos || totalProcessos || 1);
  const totalTarefas = Number(progresso?.total_tarefas || 0);
  const tarefasFeitas = Number(progresso?.tarefas_feitas || 0);
  const errosProgresso = Number(progresso?.erros || 0);
  const vpsAtivas = Number(progresso?.vps_ativas || 0);
  const vias: Array<{ label: string; processo?: string; tribunal?: string }> = Array.isArray(progresso?.vias) ? progresso.vias : [];
  const itens: Array<{ id: string; label: string; via?: string; status: string; novas?: number; mensagem?: string | null }> = Array.isArray(progresso?.itens) ? progresso.itens : [];
  const pct = totalTarefas > 0
    ? Math.min(100, Math.round((tarefasFeitas / totalTarefas) * 100))
    : (totalProcExec > 0 ? Math.min(100, Math.round((processados / totalProcExec) * 100)) : 0);

  const running = status === "executando" || status === "pendente";
  const finished = status === "concluido" || status === "cancelado" || status === "erro";

  // Realtime da execução escolhida
  useEffect(() => {
    if (!execucaoId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("execucoes_servidor").select("*").eq("id", execucaoId).maybeSingle();
      if (!cancelled) setExecucao(data);
    })();
    const ch = supabase
      .channel(`busca-publ-${execucaoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "execucoes_servidor", filter: `id=eq.${execucaoId}` },
        (payload) => setExecucao(payload.new)
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [execucaoId]);

  const handleFile = async (file: File) => {
    setLoadingUpload(true);
    setProcessos([]);
    setFileName(file.name);
    try {
      const parsed = await parsePlanilhaProcessos(file);
      setProcessos(parsed);
      if (parsed.length === 0) toast.warning("Nenhum processo encontrado na planilha.");
      else toast.success(`${parsed.length} processo(s) carregado(s).`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ler planilha");
    } finally {
      setLoadingUpload(false);
    }
  };

  const toggleTribunal = (id: string) => {
    setTribunais((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const selecionarGrupo = (g: string) => {
    const ids = TRIBUNAIS.filter((t) => t.grupo === g).map((t) => t.id);
    setTribunais((prev) => {
      const todosMarcados = ids.every((id) => prev.includes(id));
      return todosMarcados ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]));
    });
  };

  const iniciar = async () => {
    const validos = processos.filter((p) => p.valido);
    if (validos.length === 0) return toast.error("Nenhum processo válido (20 dígitos CNJ) na planilha.");
    if (!dataInicio || !dataFim) return toast.error("Informe data início e fim.");
    if (tribunais.length === 0) return toast.error("Selecione ao menos um tribunal.");
    setStarting(true);
    try {
      const payload = {
        processos: validos.map((p) => ({
          processo_original: p.processo_original,
          processo_digitos: p.processo_digitos,
        })),
        tribunais,
        dataInicio,
        dataFim,
      };
      const { data, error } = await supabase
        .from("execucoes_servidor")
        .insert({
          tipo: TIPO,
          status: "pendente",
          agendado_para: new Date().toISOString(),
          payload,
        })
        .select("id")
        .single();
      if (error) throw error;
      setExecucaoId(data.id);
      toast.success("Busca enviada ao servidor. Aguardando VPS...");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao iniciar busca");
    } finally {
      setStarting(false);
    }
  };

  const cancelar = async () => {
    if (!execucaoId) return;
    const { error } = await supabase
      .from("execucoes_servidor")
      .update({ status: "cancelado", finalizado_em: new Date().toISOString() })
      .eq("id", execucaoId)
      .in("status", ["pendente", "executando"]);
    if (error) toast.error(error.message);
    else toast.info("Cancelamento solicitado.");
  };

  const baixarRelatorio = async () => {
    if (!execucaoId) return;
    setDownloading(true);
    try {
      const all: ResultadoBusca[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("buscas_publicacao_resultados")
          .select("processo_digitos, processo_original, tribunal, data_disponibilizacao, data_publicacao, orgao, tipo_comunicacao, conteudo")
          .eq("execucao_id", execucaoId)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const blob = gerarRelatorioBuscaPublicacao(processos, all);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `busca_publicacao_${execucaoId.slice(0, 8)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar relatório");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <MainLayout title="Busca Publicação">
      <div className="p-4 lg:p-6 space-y-4 max-w-6xl">
        <p className="text-sm text-muted-foreground">
          Faça upload de uma planilha de processos, escolha o período e os tribunais.
          A busca roda nas VPS do DJEN sem afetar o DJEN Termos Servidor.
        </p>

        <Card>
          <CardHeader><CardTitle className="text-base">1. Planilha de processos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loadingUpload || running}>
                {loadingUpload ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Escolher planilha (.xlsx)
              </Button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.currentTarget.value = "";
                }}
              />
              {fileName && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileSpreadsheet className="w-4 h-4" /> {fileName}
                </span>
              )}
            </div>
            {totalProcessos > 0 && (
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">{totalProcessos} processo(s)</Badge>
                <Badge variant="secondary">{totalProcessos - invalidos} válidos</Badge>
                {invalidos > 0 && <Badge variant="destructive">{invalidos} inválido(s) (CNJ ≠ 20 dígitos)</Badge>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">2. Período</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} disabled={running} />
            </div>
            <div className="space-y-1">
              <Label>Data fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} disabled={running} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">3. Tribunais ({tribunais.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setTribunais(TRIBUNAIS.map((t) => t.id))} disabled={running}>Todos</Button>
              <Button variant="ghost" size="sm" onClick={() => setTribunais([])} disabled={running}>Limpar</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {GRUPOS.map((g) => {
              const grupoIds = TRIBUNAIS.filter((t) => t.grupo === g).map((t) => t.id);
              const todosMarcados = grupoIds.every((id) => tribunais.includes(id));
              return (
                <div key={g}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">{g}</span>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => selecionarGrupo(g)} disabled={running}>
                      {todosMarcados ? "Desmarcar" : "Marcar todos"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {TRIBUNAIS.filter((t) => t.grupo === g).map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={tribunais.includes(t.id)} onCheckedChange={() => toggleTribunal(t.id)} disabled={running} />
                        {t.nome}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {!running && !finished && (
            <Button onClick={iniciar} disabled={starting || totalProcessos === 0 || tribunais.length === 0 || !dataInicio || !dataFim}>
              {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Iniciar busca no servidor
            </Button>
          )}
          {running && (
            <Button variant="destructive" onClick={cancelar}>
              <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
          )}
          {finished && (
            <>
              <Button onClick={baixarRelatorio} disabled={downloading}>
                {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Baixar relatório (Excel)
              </Button>
              <Button variant="outline" onClick={() => { setExecucaoId(null); setExecucao(null); }}>Nova busca</Button>
            </>
          )}
        </div>

        {execucao && (
          <Card>
            <CardHeader><CardTitle className="text-base">Progresso da busca</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center text-sm">
                <Badge variant={running ? "default" : finished ? "secondary" : "outline"}>{status || "-"}</Badge>
                <span className="text-muted-foreground">Processados: {processados} / {totalProcExec}</span>
                <span className="text-muted-foreground">Publicações: {totalPubl}</span>
                {totalTarefas > 0 && (
                  <span className="text-muted-foreground">Tarefas: {tarefasFeitas} / {totalTarefas}</span>
                )}
                {vpsAtivas > 0 && <Badge variant="outline">{vpsAtivas} VPS</Badge>}
                {errosProgresso > 0 && <span className="text-destructive text-xs">{errosProgresso} erro(s)</span>}
                {execucao.worker_id && <span className="text-xs text-muted-foreground">Worker: {execucao.worker_id}</span>}
              </div>
              <Progress value={pct} className="h-2" />
              <div className="text-xs text-muted-foreground text-right">{pct}%</div>

              {vias.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">VPS em execução ({vias.length})</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {vias.map((v) => (
                      <div key={v.label} className="flex items-center gap-2 text-xs border rounded px-2 py-1">
                        <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
                        <span className="font-medium shrink-0">{v.label}</span>
                        <span className="text-muted-foreground truncate">
                          {v.processo} · {v.tribunal}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {itens.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Últimas tarefas</p>
                  <ScrollArea className="max-h-56 border rounded p-2">
                    <div className="space-y-1">
                      {itens.slice().reverse().slice(0, 80).map((it) => (
                        <div key={it.id} className="flex items-center gap-2 text-xs">
                          <Badge
                            variant="outline"
                            className={
                              it.status === "erro"
                                ? "text-[10px] px-1.5 py-0 border-destructive text-destructive"
                                : (it.novas || 0) > 0
                                  ? "text-[10px] px-1.5 py-0 border-emerald-500 text-emerald-600"
                                  : "text-[10px] px-1.5 py-0"
                            }
                          >
                            {it.status}
                          </Badge>
                          {it.via && <span className="text-muted-foreground shrink-0">{it.via}</span>}
                          <span className="truncate flex-1" title={it.mensagem || it.label}>
                            {it.label}
                            {it.mensagem && <span className="text-destructive"> · {it.mensagem}</span>}
                          </span>
                          {(it.novas || 0) > 0 && (
                            <span className="text-emerald-600 font-medium">+{it.novas}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {execucao.erro && (
                <ScrollArea className="max-h-40 border rounded p-2 text-xs bg-destructive/5">
                  <pre className="whitespace-pre-wrap">{execucao.erro}</pre>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}