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

/**
 * Importação da planilha "Resposta Santander".
 *
 * - Normaliza o número do processo para apenas dígitos para fazer o match
 *   com `dados_benner.processo`.
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

type ColMap = Record<string, number>;

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

  const reset = () => {
    setFile(null);
    setImporting(false);
    setProgress(0);
    setStatusText("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    if (importing) return;
    setOpen(next);
    if (!next) reset();
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error("Selecione a planilha de Resposta Santander");
      return;
    }
    setImporting(true);
    setProgress(0);
    setStatusText("Lendo planilha…");

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
          const processoRaw = norm(r[cols.processo]);
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

          // Dossiê — também sobrescreve quando a planilha trouxer valor
          if (cols.dossie !== undefined) {
            const v = norm(r[cols.dossie]);
            if (v) payload.__dossie = v;
          }

          all.push({ processo_digits: digits, processo_raw: processoRaw, payload });
        }
      }

      if (all.length === 0) {
        toast.error("Nenhuma linha válida encontrada (verifique a coluna Processo)");
        setImporting(false);
        return;
      }

      // Deduplica por processo (mantém último não-vazio)
      const byProcesso = new Map<string, RowIn>();
      for (const r of all) byProcesso.set(r.processo_digits, r);
      const rows = [...byProcesso.values()];

      setStatusText(`Buscando processos existentes (${rows.length})…`);

      // Busca todos pelos dígitos (compara via regexp_replace).
      // Para evitar N consultas, buscamos em lotes filtrando processo ILIKE.
      const existentesByDigits = new Map<string, { id: string; dossie: string | null }[]>();
      const LOOKUP_BATCH = 200;
      // Estratégia simples: buscamos por `processo` com OR de cada raw + digits.
      for (let i = 0; i < rows.length; i += LOOKUP_BATCH) {
        const slice = rows.slice(i, i + LOOKUP_BATCH);
        const candidatos = Array.from(
          new Set(slice.flatMap((r) => [r.processo_raw, r.processo_digits]).filter(Boolean)),
        );
        const { data, error } = await (supabase.from("dados_benner") as any)
          .select("id, processo, dossie")
          .in("processo", candidatos);
        if (error) {
          console.error(error);
          continue;
        }
        (data || []).forEach((row: any) => {
          const d = onlyDigits(row.processo);
          if (!d) return;
          const arr = existentesByDigits.get(d) || [];
          arr.push({ id: row.id, dossie: row.dossie });
          existentesByDigits.set(d, arr);
        });
      }

      let criados = 0;
      let atualizados = 0;
      const total = rows.length;

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        setProgress(Math.round(((idx + 1) / total) * 100));
        if (idx % 25 === 0)
          setStatusText(`Processando ${idx + 1}/${total} · ${criados} novos · ${atualizados} atualizados`);

        const { __dossie, ...attrs } = r.payload;
        const existentes = existentesByDigits.get(r.processo_digits) || [];

        if (existentes.length === 0) {
          const insertPayload: any = {
            ...attrs,
            processo: r.processo_raw,
            dossie: __dossie || null,
            tribunal: "TST",
            benner_atualizado: true,
          };
          const { error: insErr } = await (supabase.from("dados_benner") as any).insert(insertPayload);
          if (insErr) {
            console.error("Erro insert:", insErr);
            continue;
          }
          criados++;
        } else {
          for (const ex of existentes) {
            const updatePayload: any = { ...attrs, benner_atualizado: true };
            if (__dossie && !ex.dossie) updatePayload.dossie = __dossie;
            const { error: upErr } = await (supabase.from("dados_benner") as any)
              .update(updatePayload)
              .eq("id", ex.id);
            if (upErr) {
              console.error("Erro update:", upErr);
              continue;
            }
            atualizados++;
          }
        }
      }

      setProgress(100);
      setStatusText("Concluído!");
      const parts: string[] = [];
      if (criados > 0) parts.push(`${criados} processos criados`);
      if (atualizados > 0) parts.push(`${atualizados} atualizados (Benner=SIM)`);
      toast.success(parts.length ? parts.join(" · ") : "Nada a atualizar");
      onUpdated();
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro: " + (err?.message || String(err)));
      setImporting(false);
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
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={importing}>
            Cancelar
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