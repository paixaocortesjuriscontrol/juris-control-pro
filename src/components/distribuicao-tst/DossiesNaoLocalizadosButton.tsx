import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  fetchAllDistribuicaoTstIds,
  DistribuicaoTstFilters,
} from "@/hooks/useDistribuicoesTst";
import { isDossieInvalido } from "@/utils/gerarPlanilhaBenner";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import { getJuditAttachmentDedupKey } from "@/lib/juditAnexosDedup";

interface Props {
  filters: DistribuicaoTstFilters;
  selectedIds?: Set<string>;
}

function formatDoc(doc: string | null | undefined): string {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return String(doc || "");
}

const getJuditPartesResumo = (juditData: any, fallback?: string | null) => {
  const parties = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];
  const nonLawyers = parties.filter((p: any) => p?.nome && !p?.is_advogado);
  const ativos = [...new Set(nonLawyers
    .filter((p: any) => String(p?.polo || "").toUpperCase() === "ACTIVE")
    .map((p: any) => String(p.nome).trim()).filter(Boolean))];
  const passivos = [...new Set(nonLawyers
    .filter((p: any) => String(p?.polo || "").toUpperCase() === "PASSIVE")
    .map((p: any) => String(p.nome).trim()).filter(Boolean))];
  const partes: string[] = [];
  if (ativos.length > 0) partes.push(`Ativo: ${ativos.join(", ")}`);
  if (passivos.length > 0) partes.push(`Passivo: ${passivos.join(", ")}`);
  if (partes.length > 0) return partes.join("\n");
  const r = String(juditData?.recorrente ?? "").trim();
  return r || fallback || "";
};

const isTurmaOficialTst = (t: string | null | undefined): boolean => {
  if (!t) return false;
  const norm = String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return /^[1-8][ªa]?\s*turma$/.test(norm);
};

function extrairReclamanteJudit(juditData: any): { nome: string; doc: string } {
  const parties = Array.isArray(juditData?.parties_detail) ? juditData.parties_detail : [];
  const ativos = parties.filter(
    (p: any) =>
      !p?.is_advogado &&
      String(p?.polo || "").toUpperCase() === "ACTIVE" &&
      String(p?.nome || "").trim()
  );
  const nomes = [...new Set(ativos.map((p: any) => String(p.nome).trim()))];
  const docs = [
    ...new Set(
      ativos
        .map((p: any) => formatDoc(p?.documento))
        .filter((s: string) => !!s)
    ),
  ];
  return { nome: nomes.join("; "), doc: docs.join("; ") };
}

export function DossiesNaoLocalizadosButton({ filters, selectedIds }: Props) {
  const [open, setOpen] = useState(false);
  const [usarJudit, setUsarJudit] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const total = selectedIds?.size || 0;

  async function gerar() {
    setRunning(true);
    setProgress({ current: 0, total: 0 });
    try {
      let ids: string[];
      if (selectedIds && selectedIds.size > 0) {
        ids = Array.from(selectedIds);
      } else {
        toast.info("Buscando distribuições filtradas...");
        ids = await fetchAllDistribuicaoTstIds(filters);
      }
      if (ids.length === 0) {
        toast.info("Nenhuma distribuição encontrada com os filtros atuais.");
        return;
      }

      // Busca registros (processo + dossie) em lotes
      const registros: { processo: string; dossie: string | null }[] = [];
      const PAGE = 1000;
      for (let i = 0; i < ids.length; i += PAGE) {
        const batch = ids.slice(i, i + PAGE);
        const { data, error } = await supabase
          .from("dados_benner" as any)
          .select("processo, dossie")
          .in("id", batch);
        if (error) throw error;
        ((data as any[]) || []).forEach((r) => {
          if (r.processo) registros.push({ processo: r.processo, dossie: r.dossie });
        });
      }

      // Apenas dossiês não localizados / inválidos
      const naoLocalizados = registros.filter((r) => isDossieInvalido(r.dossie));

      // Dedup por processo
      const seen = new Set<string>();
      const unicos = naoLocalizados.filter((r) => {
        if (seen.has(r.processo)) return false;
        seen.add(r.processo);
        return true;
      });

      if (unicos.length === 0) {
        toast.info("Nenhum dossiê não localizado encontrado.");
        return;
      }

      // Monta linhas
      const rows: { Processo: string; Reclamante: string; "CPF/CNPJ"?: string; Dossiê: string }[] = [];

      if (usarJudit) {
        setProgress({ current: 0, total: unicos.length });
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id || null;

        for (let i = 0; i < unicos.length; i++) {
          const r = unicos[i];
          setProgress({ current: i + 1, total: unicos.length });
          let nome = "";
          let doc = "";
          try {
            const requestPayload = {
              numero_processo: aplicarMascaraCnj(r.processo),
              tribunal: "TST",
              com_anexos: false,
            };
            const { data: juditData, error: juditError } =
              await supabase.functions.invoke("buscar-judit", { body: requestPayload });
            try {
              await supabase.from("judit_logs" as any).insert({
                processo_numero: r.processo,
                tribunal: "TST",
                request_payload: requestPayload,
                raw_response: juditData ?? null,
                status: juditError
                  ? "erro_funcao"
                  : juditData?.error
                  ? "erro_api"
                  : "sucesso",
                error_message: juditError?.message || juditData?.error || null,
                created_by: userId,
              });
            } catch {}
            if (!juditError && juditData && !juditData.error) {
              const r2 = extrairReclamanteJudit(juditData);
              nome = r2.nome;
              doc = r2.doc;
            }
          } catch (e) {
            console.warn("[dossies-nao-loc] judit fail", r.processo, e);
          }
          rows.push({
            Processo: r.processo,
            Reclamante: nome,
            "CPF/CNPJ": doc,
            Dossiê: "Não localizado",
          });
        }
      } else {
        unicos.forEach((r) =>
          rows.push({
            Processo: r.processo,
            Reclamante: "",
            Dossiê: "Não localizado",
          })
        );
      }

      // Gera XLSX no mesmo formato do modelo (título na linha 1, header na linha 2)
      const header = usarJudit
        ? ["Processo", "Reclamante", "CPF/CNPJ", "Dossiê"]
        : ["Processo", "Reclamante", "Dossiê"];

      const aoa: any[][] = [];
      aoa.push(["Dossiês não localizados"]);
      aoa.push(header);
      rows.forEach((r) => {
        if (usarJudit) {
          aoa.push([r.Processo, r.Reclamante, r["CPF/CNPJ"] || "", r.Dossiê]);
        } else {
          aoa.push([r.Processo, r.Reclamante, r.Dossiê]);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = usarJudit
        ? [{ wch: 28 }, { wch: 45 }, { wch: 22 }, { wch: 18 }]
        : [{ wch: 28 }, { wch: 45 }, { wch: 18 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Planilha1");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Dossies_Nao_Localizados_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Planilha gerada com ${rows.length} processo(s).`);
      setOpen(false);
    } catch (err: any) {
      toast.error("Erro ao gerar planilha: " + (err?.message || String(err)));
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="w-4 h-4 mr-2" />
        {total > 0
          ? `Dossiês não localizados (${total})`
          : "Relatório Dossiês não localizados"}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !running && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Relatório Dossiês não localizados</DialogTitle>
            <DialogDescription>
              Gera planilha com os processos cujo dossiê está inválido ou não localizado,
              respeitando os filtros aplicados na tela.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2 rounded-md border p-3 bg-muted/30">
              <Checkbox
                id="usar-judit-dossies"
                checked={usarJudit}
                onCheckedChange={(v) => setUsarJudit(!!v)}
                disabled={running}
              />
              <div className="space-y-1">
                <Label htmlFor="usar-judit-dossies" className="text-sm font-medium cursor-pointer">
                  Consultar Judit para preencher Reclamante e CPF/CNPJ
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, cada processo será consultado na Judit (sem anexos) para
                  obter o nome do reclamante e o CPF/CNPJ. Pode demorar.
                </p>
              </div>
            </div>

            {running && progress.total > 0 && (
              <div className="space-y-1">
                <Progress value={(progress.current / progress.total) * 100} />
                <p className="text-xs text-muted-foreground text-center">
                  Consultando Judit: {progress.current} / {progress.total}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
              Cancelar
            </Button>
            <Button onClick={gerar} disabled={running}>
              {running && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Gerar planilha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}