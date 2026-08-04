import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { iniciarAuditoriaLote, finalizarAuditoriaLote, ItemAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";

/**
 * Importação da planilha "Resposta Santander".
 *
 * - Normaliza o número do processo para remover caracteres inválidos antes
 *   de fazer o match e antes de gravar em `dados_benner.processo`.
 * - Processos encontrados são marcados como Benner=SIM (`benner_atualizado=true`).
 * - Processos não encontrados são criados com tribunal=TST e Benner=SIM.
 * - Preenche atributos novos (centralizador, comarca, juízo, UF, objeto
 *   padrão, assunto, categoria, subcategoria) e ativa os booleanos
 *   correspondentes (turma/relator favorável/desfavorável, recurso bem/mal
 *   aparelhado, chance de êxito, resultado e ganhamos/perdemos) quando a
 *   célula da planilha tiver conteúdo.
 */

function norm(val: unknown): string {
  return String(val ?? "").trim();
}
function onlyDigits(val: unknown): string {
  return String(val ?? "").replace(/\D+/g, "");
}
function cleanProcessNumber(val: unknown): string {
  const raw = norm(val)
    .replace(/^[\s'`´‘’"]+/, "")
    .replace(/[^\d.\-/]/g, "");
  const digits = onlyDigits(raw);
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`;
  }
  return raw;
}
function normalizeHeader(val: unknown): string {
  return String(val ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
function hasValue(val: unknown): boolean {
  const s = norm(val);
  if (!s) return false;
  const low = s.toLowerCase();
  if (low === "0" || low === "nao" || low === "não" || low === "n" || low === "false" || low === "-") return false;
  return true;
}

/**
 * Converte uma célula (Date/serial/string dd/mm/yyyy) em ISO yyyy-mm-dd.
 * Retorna null quando vazio ou inválido.
 */
function parseDateCell(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof val === "number" && isFinite(val)) {
    // Excel serial date
    const ms = Math.round((val - 25569) * 86400 * 1000);
    const dt = new Date(ms);
    if (!isNaN(dt.getTime())) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const s = String(val).trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m1) {
    const dd = m1[1].padStart(2, "0");
    const mm = m1[2].padStart(2, "0");
    let yy = m1[3];
    if (yy.length === 2) yy = (parseInt(yy, 10) > 50 ? "19" : "20") + yy;
    return `${yy}-${mm}-${dd}`;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

type ColMap = Record<string, number>;
const RENATA_COORDENACAO_ID = "3e47fc83-3539-4fa7-9fcf-33825120e1b7";
const DOSSIE_COL_B = 1;
const CENTRALIZADOR_COL_C = 2;
const TIPO_RECURSO_COL_N = 13;
const PARTE_RECURSO_COL_P = 15;
const TIPO_RECURSO_DESCARTAR = "incidente de superacao e revisao dos precedentes";

function stripAccentsLower(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Centralizador aceito: vazio, "0" ou contém "Paixão". */
function centralizadorPermitido(val: unknown): boolean {
  const s = stripAccentsLower(val);
  if (!s) return true;
  if (s === "0") return true;
  return s.includes("paixao");
}

/** Distribui o tipo de recurso (col N) entre banco/reclamante conforme col P. */
function classificarTipoRecurso(
  tipoRecursoRaw: unknown,
  parteRaw: unknown,
): { banco: string | null; reclamante: string | null } {
  const tipo = norm(tipoRecursoRaw);
  const parte = norm(parteRaw);
  if (!tipo || !parte) return { banco: null, reclamante: null };
  // Se a coluna P só tem '|' (sem palavras), não preencher.
  const semParte = stripAccentsLower(parte).replace(/[|\s]/g, "") === "";
  if (semParte) return { banco: null, reclamante: null };
  const lower = stripAccentsLower(parte);
  const temReclamada = /reclamad/.test(lower);
  const temReclamante = /reclamante/.test(lower);
  return {
    banco: temReclamada ? tipo : null,
    reclamante: temReclamante ? tipo : null,
  };
}

function detectColumns(row: any[]): ColMap {
  const map: ColMap = {};
  const set = (key: string, idx: number) => {
    if (map[key] === undefined) map[key] = idx;
  };
  for (let j = 0; j < row.length; j++) {
    const h = normalizeHeader(row[j]);
    if (!h) continue;

    // Identificação
    if (h === "processo" || h.includes("numero do processo") || h === "n processo" || h === "no processo" || h.includes("n. processo"))
      set("processo", j);
    else if (h === "dossie" || h.includes("dossi"))
      set("dossie", j);

    // Atributos novos
    else if (h.includes("centralizador")) set("centralizador", j);
    else if (h === "comarca") set("comarca", j);
    else if (h.startsWith("juiz")) set("juizo", j);
    else if (h === "uf" || h.includes("estado")) set("uf", j);
    else if (h.includes("objeto")) set("objeto_padrao", j);
    else if (h === "assunto") set("assunto", j);
    else if (h.includes("subcategoria")) set("subcategoria", j);
    else if (h.includes("categoria")) set("categoria", j);

    // Turma / Relator textuais
    else if (h === "turma" || h.includes("turma tst")) set("turma", j);
    else if (h === "relator" || h.includes("ministro relator") || h.includes("relator tst")) set("relator", j);

    // Data de distribuição (coluna O na planilha; detectada por nome também)
    else if (h.includes("data") && h.includes("distribui")) set("data_distribuicao", j);

    // Booleanos posicionamento
    else if (h.includes("turma") && (h.includes("favor") || h.includes("positiv"))) set("posicao_turma_favoravel", j);
    else if (h.includes("turma") && (h.includes("desfav") || h.includes("negativ"))) set("posicao_turma_desfavoravel", j);
    else if (h.includes("relator") && (h.includes("favor") || h.includes("positiv"))) set("posicao_relator_favoravel", j);
    else if (h.includes("relator") && (h.includes("desfav") || h.includes("negativ"))) set("posicao_relator_desfavoravel", j);

    // Aparelhamento
    else if (h.includes("bem") && h.includes("aparelhad")) set("recurso_bem_aparelhado", j);
    else if (h.includes("mal") && h.includes("aparelhad")) set("recurso_mal_aparelhado", j);

    // Chance de êxito
    else if (h.includes("chance") && h.includes("exito") && (h.includes("sim") || h.endsWith("(s)"))) set("chance_exito_sim", j);
    else if (h.includes("chance") && h.includes("exito") && (h.includes("nao") || h.endsWith("(n)"))) set("chance_exito_nao", j);

    // Resultado
    else if (h.includes("sem") && h.includes("transcend")) set("resultado_sem_transcendencia", j);
    else if (h.includes("conhecido") && h.includes("nao") && h.includes("provido")) set("resultado_conhecido_nao_provido", j);
    else if (h.includes("conhecido") && h.includes("provido")) set("resultado_conhecido_provido", j);
    else if (h.includes("nao") && h.includes("conhecido")) set("resultado_nao_conhecido", j);

    // Ganhamos / Perdemos
    else if (h === "ganhamos" || h.includes("ganhamos")) set("ganhamos", j);
    else if (h === "perdemos" || h.includes("perdemos")) set("perdemos", j);
  }
  return map;
}

interface RowIn {
  processo_digits: string;
  processo_raw: string;
  aba_origem: string;
  payload: Record<string, any>;
}

interface Props {
  onUpdated: () => void;
}

export function RespostaSantanderImport({ onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const reset = () => {
    setFile(null);
    setImporting(false);
    setProgress(0);
    setStatusText("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    // Durante a importação, ignora fechamentos automáticos (ESC / clique fora).
    // O cancelamento só acontece pelo botão "Cancelar importação".
    if (importing && next === false) return;
    setOpen(next);
    if (!next) reset();
  };

  const handleCancel = () => {
    if (importing) {
      cancelRef.current = true;
      setStatusText("Cancelando…");
    } else {
      setOpen(false);
      reset();
    }
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error("Selecione a planilha de Resposta Santander");
      return;
    }
    setImporting(true);
    setProgress(0);
    setStatusText("Lendo planilha…");
    cancelRef.current = false;

    let criados = 0;
    let atualizados = 0;
    const auditId = await iniciarAuditoriaLote({
      tipo: "resposta_santander",
      arquivoNome: file.name,
      coordenacaoId: RENATA_COORDENACAO_ID,
    });
    const itensAudit: ItemAuditoriaLote[] = [];
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });

      const all: RowIn[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: true,
          defval: "",
          blankrows: false,
        }) as any[][];
        if (!json.length) continue;

        let headerIdx = -1;
        let cols: ColMap = {};
        for (let i = 0; i < Math.min(json.length, 15); i++) {
          const candidate = detectColumns(json[i] || []);
          if (candidate.processo !== undefined) {
            headerIdx = i;
            cols = candidate;
            break;
          }
        }
        if (headerIdx === -1) continue;

        for (let i = headerIdx + 1; i < json.length; i++) {
          const r = json[i];
          if (!r) continue;

          // REGRA 1: descartar linhas cujo tipo de recurso (col N) seja
          // "Incidente de superação e revisão dos precedentes".
          const tipoRecursoCelula = norm(r[TIPO_RECURSO_COL_N]);
          if (
            tipoRecursoCelula &&
            stripAccentsLower(tipoRecursoCelula).includes(TIPO_RECURSO_DESCARTAR)
          ) {
            continue;
          }

          // REGRA 2: só gravar quando centralizador (col C) for vazio, "0" ou Paixão.
          if (!centralizadorPermitido(r[CENTRALIZADOR_COL_C])) {
            continue;
          }

          const processoRaw = cleanProcessNumber(r[cols.processo]);
          const digits = onlyDigits(processoRaw);
          if (digits.length < 11) continue;

          // Regra: o que vale é a planilha. Se a coluna existe nesta aba,
          // sempre escrevemos o valor — vazio vira null/false para sobrescrever
          // qualquer dado anterior conflitante.
          const payload: Record<string, any> = {};

          // Texto
          for (const k of [
            "centralizador",
            "comarca",
            "juizo",
            "uf",
            "turma",
            "relator",
            "objeto_padrao",
            "assunto",
            "categoria",
            "subcategoria",
          ] as const) {
            if (cols[k] !== undefined) {
              const v = norm(r[cols[k]]);
              payload[k] = v ? (k === "uf" ? v.toUpperCase().slice(0, 2) : v) : null;
            }
          }

          // Data de distribuição: prioriza header detectado, com fallback para coluna O (índice 14)
          {
            const idx = cols.data_distribuicao !== undefined ? cols.data_distribuicao : 14;
            const iso = parseDateCell(r[idx]);
            payload.data_distribuicao = iso;
          }

          // Booleanos (vazio => false)
          for (const k of [
            "posicao_turma_favoravel",
            "posicao_turma_desfavoravel",
            "posicao_relator_favoravel",
            "posicao_relator_desfavoravel",
            "recurso_bem_aparelhado",
            "recurso_mal_aparelhado",
            "resultado_sem_transcendencia",
            "resultado_nao_conhecido",
            "resultado_conhecido_provido",
            "resultado_conhecido_nao_provido",
            "ganhamos",
            "perdemos",
          ] as const) {
            if (cols[k] !== undefined) payload[k] = hasValue(r[cols[k]]);
          }

          // chance_exito (texto único: Sim / Não / null)
          if (cols.chance_exito_sim !== undefined || cols.chance_exito_nao !== undefined) {
            if (cols.chance_exito_sim !== undefined && hasValue(r[cols.chance_exito_sim])) {
              payload.chance_exito = "Sim";
            } else if (cols.chance_exito_nao !== undefined && hasValue(r[cols.chance_exito_nao])) {
              payload.chance_exito = "Não";
            } else {
              payload.chance_exito = null;
            }
          }

          // REGRA 3: Tipo de recurso por parte (col N + col P).
          const { banco, reclamante } = classificarTipoRecurso(
            r[TIPO_RECURSO_COL_N],
            r[PARTE_RECURSO_COL_P],
          );
          payload.tipo_recurso_banco = banco;
          payload.tipo_recurso_reclamante = reclamante;

          // Dossiê: nesta planilha vem obrigatoriamente da coluna B.
          const dossieColB = norm(r[DOSSIE_COL_B]);
          if (dossieColB) payload.__dossie = dossieColB;

          all.push({ processo_digits: digits, processo_raw: processoRaw, aba_origem: sheetName, payload });
        }
      }

      if (all.length === 0) {
        toast.error("Nenhuma linha válida encontrada (verifique a coluna Processo)");
        await finalizarAuditoriaLote(auditId, {
          status: "erro",
          erro: "Nenhuma linha válida encontrada (coluna Processo).",
        });
        setImporting(false);
        return;
      }

      // REGRA 4: NÃO deduplicar — mantém todas as linhas da planilha.
      const rows = all;

      // REGRA 5: marcar duplicatas com ic_duplicado=true (tag "dup").
      // Considera duplicata quando o par processo_digits + dossie aparece >1x.
      const dupCount = new Map<string, number>();
      for (const r of rows) {
        const key = `${r.processo_digits}|${(r.payload.__dossie || "").trim()}`;
        dupCount.set(key, (dupCount.get(key) || 0) + 1);
      }
      for (const r of rows) {
        const key = `${r.processo_digits}|${(r.payload.__dossie || "").trim()}`;
        r.payload.ic_duplicado = (dupCount.get(key) || 0) > 1;
      }

      setStatusText(`Buscando processos existentes (${rows.length})…`);

      // Busca todos pelos dígitos (compara via regexp_replace).
      // Para evitar N consultas, buscamos em lotes filtrando processo ILIKE.
      const existentesByDigits = new Map<string, { id: string; dossie: string | null; aba_origem: string | null; coordenacao_id: string | null }[]>();
      const LOOKUP_BATCH = 80;
      // Estratégia simples: buscamos por `processo` com OR de cada raw + digits.
      for (let i = 0; i < rows.length; i += LOOKUP_BATCH) {
        if (cancelRef.current) throw new Error("__CANCELLED__");
        const slice = rows.slice(i, i + LOOKUP_BATCH);
        const candidatos = Array.from(
          new Set(
            slice
              .flatMap((r) => [r.processo_raw, r.processo_digits, `'${r.processo_raw}`, `'${r.processo_digits}`])
              .filter(Boolean),
          ),
        );
        const { data, error } = await (supabase.from("dados_benner") as any)
          .select("id, processo, dossie, aba_origem, coordenacao_id")
          .in("processo", candidatos)
          .or(`coordenacao_id.eq.${RENATA_COORDENACAO_ID},coordenacao_id.is.null`);
        if (error) {
          console.error(error);
          continue;
        }
        (data || []).forEach((row: any) => {
          const d = onlyDigits(row.processo);
          if (!d) return;
          const arr = existentesByDigits.get(d) || [];
          arr.push({ id: row.id, dossie: row.dossie, aba_origem: row.aba_origem, coordenacao_id: row.coordenacao_id });
          existentesByDigits.set(d, arr);
        });
      }

      const total = rows.length;

      // Separa em inserts e updates
      const toInsert: any[] = [];
      const toUpdate: { id: string; payload: any }[] = [];

      for (const r of rows) {
        const { __dossie, ...attrs } = r.payload;
        const existentes = existentesByDigits.get(r.processo_digits) || [];
        if (existentes.length === 0) {
          toInsert.push({
            ...attrs,
            processo: r.processo_raw,
            dossie: __dossie || null,
            aba_origem: r.aba_origem,
            coordenacao_id: RENATA_COORDENACAO_ID,
            tribunal: "TST",
            benner_atualizado: true,
            fontes_importacao: ["Resposta Santander"],
          });
          itensAudit.push({
            processo: r.processo_raw,
            dossie: __dossie || null,
            acao: "criado",
            detalhe: `Cadastrado (Benner=SIM) · aba ${r.aba_origem}`,
          });
        } else {
          for (const ex of existentes) {
            const updatePayload: any = { ...attrs, benner_atualizado: true };
            if (__dossie) updatePayload.dossie = __dossie;
            if (!ex.aba_origem) updatePayload.aba_origem = r.aba_origem;
            if (!ex.coordenacao_id) updatePayload.coordenacao_id = RENATA_COORDENACAO_ID;
            toUpdate.push({ id: ex.id, payload: updatePayload });
            itensAudit.push({
              processo: r.processo_raw,
              dossie: __dossie || ex.dossie || null,
              acao: "atualizado",
              detalhe: `Campos: ${Object.keys(updatePayload).join(", ")}`,
            });
          }
        }
      }

      // Inserts em lote
      const INSERT_BATCH = 500;
      for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
        if (cancelRef.current) throw new Error("__CANCELLED__");
        const slice = toInsert.slice(i, i + INSERT_BATCH);
        setStatusText(`Inserindo ${i + slice.length}/${toInsert.length} novos…`);
        const { error } = await (supabase.from("dados_benner") as any).insert(slice);
        if (error) {
          console.error("Erro insert lote:", error);
        } else {
          criados += slice.length;
        }
        setProgress(Math.round(((i + slice.length) / Math.max(total, 1)) * 30));
      }

      // Updates paralelos com limite de concorrência
      const CONCURRENCY = 20;
      let done = 0;
      const runUpdate = async (item: { id: string; payload: any }) => {
        const { error } = await (supabase.from("dados_benner") as any)
          .update(item.payload)
          .eq("id", item.id);
        if (error) console.error("Erro update:", error);
        else atualizados++;
        // Marca a fonte de importação sem sobrescrever outras tags já presentes
        await (supabase as any).rpc("add_fonte_importacao", {
          p_id: item.id,
          p_fonte: "Resposta Santander",
        });
        done++;
        if (done % 50 === 0 || done === toUpdate.length) {
          setStatusText(`Atualizando ${done}/${toUpdate.length} · ${criados} novos`);
          setProgress(30 + Math.round((done / Math.max(toUpdate.length, 1)) * 70));
        }
      };

      for (let i = 0; i < toUpdate.length; i += CONCURRENCY) {
        if (cancelRef.current) throw new Error("__CANCELLED__");
        const chunk = toUpdate.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(runUpdate));
      }

      setProgress(100);
      setStatusText("Concluído!");
      const parts: string[] = [];
      if (criados > 0) parts.push(`${criados} processos criados`);
      if (atualizados > 0) parts.push(`${atualizados} atualizados (Benner=SIM)`);
      toast.success(parts.length ? parts.join(" · ") : "Nada a atualizar");
      await finalizarAuditoriaLote(auditId, {
        status: "concluida",
        totalLinhas: rows.length,
        criados,
        atualizados,
        resumo: parts.length ? parts.join(" · ") : "Nada a atualizar",
        itens: itensAudit,
      });
      onUpdated();
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1500);
    } catch (err: any) {
      if (err?.message === "__CANCELLED__") {
        const parts: string[] = [];
        if (criados > 0) parts.push(`${criados} criados`);
        if (atualizados > 0) parts.push(`${atualizados} atualizados`);
        toast.info(
          parts.length
            ? `Cancelado · parcial salvo: ${parts.join(" · ")}`
            : "Importação cancelada (nada foi salvo ainda)",
        );
        await finalizarAuditoriaLote(auditId, {
          status: "cancelada",
          criados,
          atualizados,
          resumo: parts.length ? `Cancelado · parcial salvo: ${parts.join(" · ")}` : "Cancelado antes de salvar",
          itens: itensAudit,
        });
        onUpdated();
        setOpen(false);
        reset();
      } else {
        console.error(err);
        toast.error("Erro: " + (err?.message || String(err)));
        await finalizarAuditoriaLote(auditId, {
          status: "erro",
          erro: err?.message || String(err),
          criados,
          atualizados,
          itens: itensAudit,
        });
        setImporting(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <FileText className="w-3 h-3 mr-1" />
          Resposta Santander
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Resposta Santander</DialogTitle>
          <DialogDescription>
            Lê todas as abas, marca <strong>Benner = SIM</strong> e preenche centralizador,
            comarca, juízo, UF, objeto padrão, assunto, categoria, subcategoria, posicionamento
            de turma/relator, aparelhamento do recurso, chance de êxito, resultado e
            ganhamos/perdemos para os processos correspondentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Planilha (.xlsx)</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.xltx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={importing}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/80"
            />
            {file && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" /> {file.name}
              </p>
            )}
          </div>

          {importing && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground truncate">{statusText}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>
            {importing ? "Cancelar importação" : "Cancelar"}
          </Button>
          <Button onClick={handleProcess} disabled={importing || !file}>
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Processar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}