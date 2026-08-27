import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FileSpreadsheet, Upload, Loader2, AlertCircle, CheckCircle2, Download, Tag, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEtiquetas } from "@/hooks/useEtiquetas";
import { baixarModeloPautasExcel } from "@/lib/pautasExcelModelo";
import {
  parsePautaExcel,
  type PautaExcelRow,
  type PautaExcelParseError,
} from "@/lib/pautasExcelParser";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coordenacaoId: string;
  coordenacaoNome: string;
}

type Etapa = "upload" | "preview" | "importando" | "concluido";

interface ResumoImport {
  processosCriados: number;
  processosExistentes: number;
  audienciasCriadas: number;
  audienciasDuplicadas: number;
  erros: { linha: number; motivo: string; processo?: string }[];
}

export function PautasExcelDialog({
  open,
  onOpenChange,
  coordenacaoId,
  coordenacaoNome,
}: Props) {
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [linhas, setLinhas] = useState<PautaExcelRow[]>([]);
  const [errosParse, setErrosParse] = useState<PautaExcelParseError[]>([]);
  const [processosExistentes, setProcessosExistentes] = useState<Set<string>>(new Set());
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([]);
  const [progresso, setProgresso] = useState(0);
  const [resumo, setResumo] = useState<ResumoImport | null>(null);
  const [etiquetasSel, setEtiquetasSel] = useState<string[]>([]);
  const [buscaEtiqueta, setBuscaEtiqueta] = useState("");
  const { data: catalogoEtiquetas = [], isLoading: carregandoEtiquetas } = useEtiquetas(
    coordenacaoId,
    "itens",
  );

  const etiquetasFiltradas = useMemo(() => {
    const q = buscaEtiqueta.trim().toLowerCase();
    return q
      ? catalogoEtiquetas.filter((e) => e.nome.toLowerCase().includes(q))
      : catalogoEtiquetas;
  }, [catalogoEtiquetas, buscaEtiqueta]);

  const toggleEtiqueta = (id: string, checked: boolean) =>
    setEtiquetasSel((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));


  const normalizarTitulo = (titulo: string | null | undefined) =>
    String(titulo ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const diaLocalISO = (dataHora: string | null | undefined) => {
    if (!dataHora) return null;
    // Datas vindas do banco já chegam em ISO; usamos o dia em BRT para comparar
    const bruto = String(dataHora);
    const soData = bruto.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(soData) && bruto.length <= 10) return soData;
    const data = new Date(bruto);
    if (Number.isNaN(data.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(data);
  };

  /**
   * Chave de duplicidade: mesmo processo + MESMO DIA + MESMO TÍTULO.
   * A hora é ignorada de propósito — reimportar a mesma pauta com horário
   * ajustado não deve duplicar a audiência/tarefa.
   */
  const audienciaKey = (
    processoId: string,
    dataHora: string | null | undefined,
    titulo: string | null | undefined,
  ) => {
    const dia = diaLocalISO(dataHora);
    if (!processoId || !dia) return null;
    return `${processoId}|${dia}|${normalizarTitulo(titulo)}`;
  };

  const resetAll = useCallback(() => {
    setEtapa("upload");
    setNomeArquivo("");
    setLinhas([]);
    setErrosParse([]);
    setProcessosExistentes(new Set());
    setResponsaveisIds([]);
    setEtiquetasSel([]);
    setBuscaEtiqueta("");

    setProgresso(0);
    setResumo(null);
  }, []);

  const handleClose = () => {
    if (etapa === "importando") return;
    onOpenChange(false);
    setTimeout(resetAll, 300);
  };

  const handleFile = async (file: File) => {
    setNomeArquivo(file.name);
    try {
      const buf = await file.arrayBuffer();
      const { linhas: ls, erros } = parsePautaExcel(buf);
      if (ls.length === 0) {
        toast.error("Nenhuma linha válida encontrada na planilha.");
        setErrosParse(erros);
        setLinhas([]);
        return;
      }

      // Consultar quais processos já existem nesta coordenação
      const numerosMasked = Array.from(new Set(ls.map((l) => l.processo_numero)));
      const numerosDigits = Array.from(new Set(ls.map((l) => l.processo_digits)));
      const { data: processosDb } = await supabase
        .from("processos")
        .select("numero")
        .eq("coordenacao_id", coordenacaoId)
        .or(
          [
            `numero.in.(${numerosMasked.map((n) => `"${n}"`).join(",")})`,
            `numero.in.(${numerosDigits.map((n) => `"${n}"`).join(",")})`,
          ].join(",")
        );

      const existSet = new Set<string>();
      for (const p of processosDb || []) {
        const d = String(p.numero || "").replace(/\D/g, "");
        if (d) existSet.add(d);
      }

      setLinhas(ls);
      setErrosParse(erros);
      setProcessosExistentes(existSet);
      setEtapa("preview");
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao ler planilha: ${e.message || e}`);
    }
  };

  const novosCount = useMemo(
    () => linhas.filter((l) => !processosExistentes.has(l.processo_digits)).length,
    [linhas, processosExistentes]
  );

  const executarImport = async () => {
    if (responsaveisIds.length === 0) {
      toast.error("Selecione ao menos um responsável para as audiências.");
      return;
    }

    setEtapa("importando");
    setProgresso(0);
    const r: ResumoImport = {
      processosCriados: 0,
      processosExistentes: 0,
      audienciasCriadas: 0,
      audienciasDuplicadas: 0,
      erros: [...errosParse],
    };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada.");
      setEtapa("preview");
      return;
    }

    // 1) Buscar processos existentes na coordenação (mapa digits → id)
    const digits = Array.from(new Set(linhas.map((l) => l.processo_digits)));
    const numerosMasked = Array.from(new Set(linhas.map((l) => l.processo_numero)));
    const { data: procsExistentes } = await supabase
      .from("processos")
      .select("id, numero")
      .eq("coordenacao_id", coordenacaoId)
      .or(
        [
          `numero.in.(${numerosMasked.map((n) => `"${n}"`).join(",")})`,
          `numero.in.(${digits.map((n) => `"${n}"`).join(",")})`,
        ].join(",")
      );

    const procIdByDigits = new Map<string, string>();
    for (const p of procsExistentes || []) {
      const d = String(p.numero || "").replace(/\D/g, "");
      if (d) procIdByDigits.set(d, p.id as string);
    }
    r.processosExistentes = procIdByDigits.size;

    // 2) Criar processos ausentes (dedup por digits, primeira ocorrência ganha)
    const primeirasPorDigits = new Map<string, PautaExcelRow>();
    for (const l of linhas) {
      if (!procIdByDigits.has(l.processo_digits) && !primeirasPorDigits.has(l.processo_digits)) {
        primeirasPorDigits.set(l.processo_digits, l);
      }
    }

    for (const l of primeirasPorDigits.values()) {
      const { data, error } = await supabase
        .from("processos")
        .insert({
          numero: l.processo_numero,
          tribunal: l.foro || null,
          orgao_julgador: l.vara_camara || null,
          vara: l.vara_camara || null,
          comarca: l.comarca || null,
          uf: l.uf || null,
          polo_ativo: l.polo_ativo || null,
          coordenacao_id: coordenacaoId,
          area: "trabalhista",
          status: "ativo",
        })
        .select("id, numero")
        .single();
      if (error) {
        r.erros.push({ linha: l.linha, motivo: `Erro ao cadastrar processo: ${error.message}`, processo: l.processo_numero });
        continue;
      }
      procIdByDigits.set(l.processo_digits, data.id as string);
      r.processosCriados++;
    }

    // 3) Pré-consulta de duplicidade: atividade (audiência, tarefa ou evento)
    //    já existente no MESMO processo + MESMO DIA + MESMO TÍTULO bloqueia a criação.
    //    Se o título for diferente, permite criar a nova atividade.
    const procIds = Array.from(new Set(Array.from(procIdByDigits.values())));
    const audChave = new Set<string>(); // processo|dia|titulo

    if (procIds.length > 0) {
      const [{ data: audienciasDb }, { data: tarefasDb }, { data: eventosDb }] = await Promise.all([
        supabase
          .from("audiencias_detectadas")
          .select("processo_id, data_audiencia, titulo")
          .in("processo_id", procIds),
        supabase
          .from("tarefas")
          .select("processo_id, titulo, data_vencimento")
          .in("processo_id", procIds),
        supabase
          .from("eventos_agenda")
          .select("processo_id, titulo, data_inicio")
          .in("processo_id", procIds),
      ]);

      for (const a of audienciasDb || []) {
        const chave = audienciaKey((a as any).processo_id || "", (a as any).data_audiencia, (a as any).titulo);
        if (chave) audChave.add(chave);
      }
      for (const t of tarefasDb || []) {
        const chave = audienciaKey((t as any).processo_id || "", (t as any).data_vencimento, (t as any).titulo);
        if (chave) audChave.add(chave);
      }
      for (const e of eventosDb || []) {
        const chave = audienciaKey((e as any).processo_id || "", (e as any).data_inicio, (e as any).titulo);
        if (chave) audChave.add(chave);
      }
    }

    // 4) Criar audiências
    let processadas = 0;
    for (const l of linhas) {
      processadas++;
      setProgresso(Math.round((processadas / linhas.length) * 100));

      const procId = procIdByDigits.get(l.processo_digits);
      if (!procId) continue;

      const hora = l.hora || "12:00";
      const dataAudISO = `${l.data_iso}T${hora}:00-03:00`;
      const titulo = l.tipo || "Audiência";
      const chaveAudiencia = audienciaKey(procId, l.data_iso, titulo);

      if (chaveAudiencia && audChave.has(chaveAudiencia)) {
        r.audienciasDuplicadas++;
        continue;
      }



      const audId = crypto.randomUUID();
      const { error: audErr } = await supabase
        .from("audiencias_detectadas")
        .insert({
          id: audId,
          processo_id: procId,
          processo_numero: l.processo_numero,
          titulo,
          tipo_audiencia: l.tipo || null,
          data_audiencia: dataAudISO,
          hora: l.hora || null,
          forum: l.foro || null,
          sala_forum: l.vara_camara || null,
          vara_camara: l.vara_camara || null,
          local_audiencia: l.local || null,
          comarca: l.comarca || null,
          polo_ativo: l.polo_ativo || null,
          cliente: l.cliente || null,
          terceirizado: l.terceirizada,
          modalidade: l.modalidade || null,
          observacoes: l.observacoes || null,
          coordenacao_id: coordenacaoId,
          criado_por: user.id,
          status: "pendente",
          origem: "pauta_excel",
        });

      if (audErr) {
        r.erros.push({
          linha: l.linha,
          motivo: `Erro ao cadastrar audiência: ${audErr.message || "desconhecido"}`,
          processo: l.processo_numero,
        });
        continue;
      }

      // Vincular responsáveis
      const advogadosInsert = responsaveisIds.map((advogadoId) => ({
        audiencia_id: audId,
        advogado_id: advogadoId,
      }));
      if (advogadosInsert.length > 0) {
        await supabase.from("audiencias_advogados").insert(advogadosInsert);
      }

      if (chaveAudiencia) audChave.add(chaveAudiencia);
      r.audienciasCriadas++;
    }


    setResumo(r);
    setEtapa("concluido");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["audiencias-detectadas"] }),
      queryClient.invalidateQueries({ queryKey: ["audiencias-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["painel-controle-audiencias-det-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["processos"] }),
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Pautas Excel
          </DialogTitle>
          <DialogDescription>
            Coordenação: <strong>{coordenacaoNome}</strong>
          </DialogDescription>
        </DialogHeader>

        {etapa === "upload" && (
          <div className="space-y-4 py-4">
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-10 cursor-pointer hover:bg-muted/40 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Selecione a planilha de pautas (.xlsx)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Colunas esperadas: DATA, HORA, NÚMERO DO PROCESSO, FORO, VT/CÂMARA, Local,
                  COMARCA, UF, PÓLO ATIVO, CLIENTE, TERCEIRIZADA, TIPO, TELEPRESENCIAL,
                  OBSERVAÇÕES/PROVIDÊNCIAS.
                </p>
              </div>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </div>
        )}

        {etapa === "preview" && (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <Badge variant="secondary">{nomeArquivo}</Badge>
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                {linhas.length} linhas válidas
              </Badge>
              {novosCount > 0 && (
                <Badge variant="outline">{novosCount} processos novos</Badge>
              )}
              {linhas.length - novosCount > 0 && (
                <Badge variant="outline">{linhas.length - novosCount} já cadastrados</Badge>
              )}
              {errosParse.length > 0 && (
                <Badge variant="destructive">{errosParse.length} linhas com erro</Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Responsáveis pelas audiências{" "}
                <span className="text-destructive">*</span>
              </Label>
              <PeoplePicker
                selectedIds={responsaveisIds}
                onChange={setResponsaveisIds}
                placeholder="Adicionar responsável"
                emptyLabel="Nenhum responsável selecionado — obrigatório"
              />
              <p className="text-xs text-muted-foreground">
                Os responsáveis selecionados serão vinculados a todas as audiências importadas.
              </p>
            </div>

            <ScrollArea className="flex-1 border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Linha</th>
                    <th className="p-2 text-left">Data / Hora</th>
                    <th className="p-2 text-left">Processo</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Foro / Vara</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.linha} className="border-t">
                      <td className="p-2">{l.linha}</td>
                      <td className="p-2">
                        {l.data_iso.split("-").reverse().join("/")}
                        {l.hora ? ` ${l.hora}` : ""}
                      </td>
                      <td className="p-2 font-mono">{l.processo_numero}</td>
                      <td className="p-2">{l.tipo}</td>
                      <td className="p-2">
                        {l.foro}
                        {l.vara_camara ? ` — ${l.vara_camara}` : ""}
                      </td>
                      <td className="p-2">{l.cliente}</td>
                      <td className="p-2">
                        {processosExistentes.has(l.processo_digits) ? (
                          <Badge variant="outline" className="text-[10px]">Existente</Badge>
                        ) : (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Novo</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {errosParse.map((e) => (
                    <tr key={`err-${e.linha}`} className="border-t bg-destructive/10">
                      <td className="p-2">{e.linha}</td>
                      <td colSpan={5} className="p-2 text-destructive">
                        {e.motivo}
                        {e.processo ? ` — ${e.processo}` : ""}
                      </td>
                      <td className="p-2">
                        <Badge variant="destructive" className="text-[10px]">Erro</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {etapa === "importando" && (
          <div className="space-y-4 py-8">
            <div className="flex items-center gap-3 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Importando pautas…</span>
            </div>
            <Progress value={progresso} />
            <p className="text-xs text-center text-muted-foreground">{progresso}%</p>
          </div>
        )}

        {etapa === "concluido" && resumo && (
          <div className="space-y-3 py-4">
            <Alert className="border-emerald-600/40 bg-emerald-600/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription>Importação concluída.</AlertDescription>
            </Alert>
            <ul className="text-sm space-y-1">
              <li>• Processos criados: <strong>{resumo.processosCriados}</strong></li>
              <li>• Processos reutilizados: <strong>{resumo.processosExistentes}</strong></li>
              <li>• Audiências criadas: <strong>{resumo.audienciasCriadas}</strong></li>
              <li>• Audiências duplicadas ignoradas: <strong>{resumo.audienciasDuplicadas}</strong></li>
              <li>• Erros: <strong>{resumo.erros.length}</strong></li>
            </ul>
            {resumo.erros.length > 0 && (
              <ScrollArea className="max-h-40 border rounded-md p-2">
                <ul className="text-xs space-y-1">
                  {resumo.erros.map((e, i) => (
                    <li key={i} className="flex gap-2 items-start">
                      <AlertCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                      <span>
                        Linha {e.linha}: {e.motivo}
                        {e.processo ? ` (${e.processo})` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          {etapa === "upload" && (
            <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          )}
          {etapa === "preview" && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={executarImport}
                disabled={linhas.length === 0 || responsaveisIds.length === 0}
              >
                Importar {linhas.length} audiências
              </Button>
            </>
          )}
          {etapa === "concluido" && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}