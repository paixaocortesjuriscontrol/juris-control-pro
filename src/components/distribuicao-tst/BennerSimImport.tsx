import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useProfilesBasic } from "@/hooks/useDistribuicaoResponsaveis";
import { iniciarAuditoriaLote, finalizarAuditoriaLote, ItemAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";

const RENATA_COORDENACAO_ID = "3e47fc83-3539-4fa7-9fcf-33825120e1b7";

function norm(val: unknown): string {
  return String(val ?? "").trim();
}
function normalizeHeader(val: unknown): string {
  return String(val ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
function parseDateBR(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(val).trim();
  if (!raw) return null;
  const t = raw.split(/[\sT]/)[0];
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (m) {
    const dia = m[1].padStart(2, "0");
    const mes = m[2].padStart(2, "0");
    let ano = m[3];
    if (ano.length === 2) {
      const n = Number(ano);
      ano = (n >= 70 ? 1900 + n : 2000 + n).toString();
    }
    if (Number(mes) < 1 || Number(mes) > 12) return null;
    if (Number(dia) < 1 || Number(dia) > 31) return null;
    return `${ano}-${mes}-${dia}`;
  }
  const n = Number(raw);
  if (!isNaN(n) && n > 30000 && n < 100000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${mm}-${dd}`;
    }
  }
  return null;
}

interface RowIn {
  processo: string;
  dossie: string;
  reclamante: string;
  data_distribuicao: string | null;
  aba_origem: string;
}

interface Props {
  onUpdated: () => void;
}

export function BennerSimImport({ onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { profiles, loading: loadingProfiles } = useProfilesBasic(RENATA_COORDENACAO_ID);

  const responsavelNome = profiles.find(p => p.id === responsavelId)?.nome || "";

  const reset = () => {
    setFile(null);
    setResponsavelId("");
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
      toast.error("Selecione a planilha");
      return;
    }
    if (!responsavelId) {
      toast.error("Selecione o responsável");
      return;
    }

    setImporting(true);
    setProgress(0);
    setStatusText("Lendo planilha…");

    const auditId = await iniciarAuditoriaLote({
      tipo: "benner_sim",
      arquivoNome: file.name,
      coordenacaoId: RENATA_COORDENACAO_ID,
      detalhes: { responsavel: responsavelNome },
    });
    const itensAudit: ItemAuditoriaLote[] = [];
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });

      const all: RowIn[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "", blankrows: false }) as any[][];
        if (!json.length) continue;

        let headerIdx = -1;
        let cData = -1, cProcesso = -1, cDossie = -1, cReclamante = -1;
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const row = json[i];
          if (!row) continue;
          let dCol = -1, pCol = -1, doCol = -1, rCol = -1;
          for (let j = 0; j < row.length; j++) {
            const h = normalizeHeader(row[j]);
            if (!h) continue;
            if (dCol === -1 && h.includes("data") && h.includes("distrib")) dCol = j;
            if (pCol === -1 && (h.includes("numero do processo") || h === "numero" || h === "n processo" || h === "no processo" || h.includes("n. processo"))) pCol = j;
            if (doCol === -1 && (h === "dossie" || h.includes("dossi"))) doCol = j;
            if (rCol === -1 && h.includes("reclamante")) rCol = j;
          }
          if (pCol !== -1 && doCol !== -1) {
            headerIdx = i; cData = dCol; cProcesso = pCol; cDossie = doCol; cReclamante = rCol;
            break;
          }
        }
        if (headerIdx === -1) continue;

        for (let i = headerIdx + 1; i < json.length; i++) {
          const r = json[i]; if (!r) continue;
          const processo = norm(r[cProcesso]);
          if (!processo || processo.length < 7) continue;
          const dossie = cDossie >= 0 ? norm(r[cDossie]) : "";
          const reclamante = cReclamante >= 0 ? norm(r[cReclamante]) : "";
          const dataDist = cData >= 0 ? parseDateBR(r[cData]) : null;
          all.push({ processo, dossie, reclamante, data_distribuicao: dataDist, aba_origem: sheetName });
        }
      }

      if (all.length === 0) {
        toast.error("Nenhuma linha válida encontrada (verifique colunas: DATA DA DISTRIBUIÇÃO, NÚMERO DO PROCESSO, DOSSIÊ, RECLAMANTE)");
        await finalizarAuditoriaLote(auditId, {
          status: "erro",
          erro: "Nenhuma linha válida encontrada na planilha.",
        });
        setImporting(false);
        return;
      }

      const byProcesso = new Map<string, RowIn>();
      for (const r of all) {
        const cur = byProcesso.get(r.processo);
        if (!cur) { byProcesso.set(r.processo, r); continue; }
        if (!cur.dossie && r.dossie) byProcesso.set(r.processo, r);
      }
      const rows = [...byProcesso.values()];

      setStatusText(`Buscando processos existentes (${rows.length})…`);

      const numeros = rows.map(r => r.processo);
      const existentesByProcesso = new Map<string, { id: string; dossie: string | null }[]>();
      const LOOKUP_BATCH = 200;
      for (let i = 0; i < numeros.length; i += LOOKUP_BATCH) {
        const slice = numeros.slice(i, i + LOOKUP_BATCH);
        const { data, error } = await (supabase.from("dados_benner") as any)
          .select("id, processo, dossie")
          .eq("coordenacao_id", RENATA_COORDENACAO_ID)
          .in("processo", slice);
        if (error) { console.error(error); continue; }
        (data || []).forEach((row: any) => {
          const arr = existentesByProcesso.get(row.processo) || [];
          arr.push({ id: row.id, dossie: row.dossie });
          existentesByProcesso.set(row.processo, arr);
        });
      }

      let criados = 0, atualizados = 0, dossiesPreenchidos = 0, vinculosResp = 0;
      const idsParaVincular: string[] = [];
      const total = rows.length;

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        setProgress(Math.round(((idx + 1) / total) * 90));
        if (idx % 25 === 0) setStatusText(`Processando ${idx + 1}/${total} · ${criados} novos · ${atualizados} atualizados`);

        const existentes = existentesByProcesso.get(r.processo) || [];

        if (existentes.length === 0) {
          const insertPayload: any = {
            processo: r.processo,
            dossie: r.dossie || null,
            reclamante: r.reclamante || null,
            data_distribuicao_planilha: r.data_distribuicao,
            aba_origem: r.aba_origem,
            coordenacao_id: RENATA_COORDENACAO_ID,
            tribunal: "TST",
            benner_atualizado: true,
          };
          const { data: ins, error: insErr } = await (supabase.from("dados_benner") as any)
            .insert(insertPayload)
            .select("id")
            .single();
          if (insErr) { console.error("Erro insert:", insErr); continue; }
          criados++;
          itensAudit.push({
            processo: r.processo,
            dossie: r.dossie || null,
            acao: "criado",
            detalhe: `Cadastrado com Benner=SIM · aba ${r.aba_origem}`,
          });
          if (ins?.id) idsParaVincular.push(ins.id);
        } else {
          for (const ex of existentes) {
            const updatePayload: any = { benner_atualizado: true };
            if (!ex.dossie && r.dossie) {
              updatePayload.dossie = r.dossie;
              dossiesPreenchidos++;
            }
            const { error: upErr } = await (supabase.from("dados_benner") as any)
              .update(updatePayload)
              .eq("id", ex.id);
            if (upErr) { console.error("Erro update:", upErr); continue; }
            atualizados++;
            itensAudit.push({
              processo: r.processo,
              dossie: updatePayload.dossie ?? ex.dossie ?? null,
              acao: "atualizado",
              detalhe: `Benner=SIM${updatePayload.dossie ? ` · dossiê preenchido: ${updatePayload.dossie}` : ""}`,
            });
            idsParaVincular.push(ex.id);
          }
        }
      }

      setStatusText(`Vinculando ${responsavelNome} como responsável…`);
      setProgress(95);
      if (idsParaVincular.length > 0) {
        const VINC_BATCH = 200;
        for (let i = 0; i < idsParaVincular.length; i += VINC_BATCH) {
          const slice = idsParaVincular.slice(i, i + VINC_BATCH);
          const { data: existentesResp } = await (supabase.from("dados_benner_responsaveis") as any)
            .select("dados_benner_id")
            .eq("usuario_id", responsavelId)
            .in("dados_benner_id", slice);
          const jaVinculados = new Set((existentesResp || []).map((x: any) => x.dados_benner_id));
          const faltam = slice.filter(id => !jaVinculados.has(id));
          if (faltam.length === 0) continue;
          const insertRows = faltam.map(id => ({ dados_benner_id: id, usuario_id: responsavelId }));
          const { error: insErr } = await (supabase.from("dados_benner_responsaveis") as any)
            .insert(insertRows);
          if (insErr) { console.error("Erro vincular responsável:", insErr); continue; }
          vinculosResp += faltam.length;
        }
      }

      setProgress(100);
      setStatusText("Concluído!");
      const parts: string[] = [];
      if (criados > 0) parts.push(`${criados} processos criados`);
      if (atualizados > 0) parts.push(`${atualizados} marcados Benner=SIM`);
      if (dossiesPreenchidos > 0) parts.push(`${dossiesPreenchidos} dossiês preenchidos`);
      if (vinculosResp > 0) parts.push(`${vinculosResp} vinculados a ${responsavelNome}`);
      toast.success(parts.length ? parts.join(" · ") : "Nada a atualizar");
      await finalizarAuditoriaLote(auditId, {
        status: "concluida",
        totalLinhas: rows.length,
        criados,
        atualizados,
        resumo: parts.length ? parts.join(" · ") : "Nada a atualizar",
        itens: itensAudit,
        detalhes: { responsavel: responsavelNome, dossies_preenchidos: dossiesPreenchidos, vinculos_responsavel: vinculosResp },
      });
      onUpdated();
      setTimeout(() => { setOpen(false); reset(); }, 1500);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro: " + (err?.message || String(err)));
      await finalizarAuditoriaLote(auditId, {
        status: "erro",
        erro: err?.message || String(err),
        itens: itensAudit,
      });
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Benner SIM
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar planilha (Benner = SIM)</DialogTitle>
          <DialogDescription>
            Lê todas as abas, marca <strong>Benner=SIM</strong>, preenche dossiês vazios, cria processos novos e vincula o responsável escolhido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Responsável (Coordenação Dra. Renata)</Label>
            <Select value={responsavelId} onValueChange={setResponsavelId} disabled={importing || loadingProfiles}>
              <SelectTrigger>
                <SelectValue placeholder={loadingProfiles ? "Carregando membros…" : "Selecionar responsável…"} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Planilha (.xlsx)</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
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
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={importing}>Cancelar</Button>
          <Button onClick={handleProcess} disabled={importing || !file || !responsavelId}>
            {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Processar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
