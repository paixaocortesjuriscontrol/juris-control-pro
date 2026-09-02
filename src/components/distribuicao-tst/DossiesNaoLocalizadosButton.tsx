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
import {
  buildJuditPatch,
  persistirJuditAnexos,
  persistirPartesJudit,
  gravarJuditLog,
  extrairReclamanteReclamada,
  extrairDocumentosReclamante,
  formatDoc,
} from "@/lib/juditDistribuicaoTst";
import { useTurmasTst, useRelatoresTst } from "@/hooks/useClassificacaoTst";

interface Props {
  filters: DistribuicaoTstFilters;
  selectedIds?: Set<string>;
  /** Quando controlado externamente (ex.: item de menu), o botão próprio não é renderizado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function DossiesNaoLocalizadosButton({
  filters,
  selectedIds,
  open: openProp,
  onOpenChange,
  hideTrigger,
}: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOpenInternal(v));
  const [usarJudit, setUsarJudit] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { data: turmasTst = [] } = useTurmasTst();
  const { data: relatoresTst = [] } = useRelatoresTst();

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
      // Lote pequeno para evitar URL muito longa (Bad Request 400) no .in("id", [...])
      const PAGE = 200;
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
              origem: "dossies-nao-localizados",
            };
            const { data: juditData, error: juditError } =
              await supabase.functions.invoke("buscar-judit", { body: requestPayload });
            await gravarJuditLog({
              processoNumero: r.processo,
              tribunal: "TST",
              requestPayload,
              juditData,
              juditError,
              userId,
            });
            if (!juditError && juditData && !juditData.error) {
              // ===== EXATAMENTE as mesmas regras do botão Judit do formulário.
              // Helper compartilhado em src/lib/juditDistribuicaoTst.ts.
              const { patch, reclamante: reclamanteJudit } = buildJuditPatch(
                juditData,
                turmasTst,
                relatoresTst,
              );
              nome = reclamanteJudit
                .split(/\s*\/\s*/)
                .map((n) => n.trim())
                .filter(Boolean)
                .join("; ");
              doc = extrairDocumentosReclamante(juditData, reclamanteJudit);

              // Anexos (mesma persistência do form)
              const atts = Array.isArray((juditData as any)?.attachments) ? (juditData as any).attachments : [];
              try {
                await persistirJuditAnexos(r.processo, atts, userId);
              } catch (e) {
                console.warn("[dossies-nao-loc] anexos fail", e);
              }

              // Upsert dados_benner com o mesmo patch que o form aplicaria
              const { data: existingBenner } = await supabase
                .from("dados_benner" as any)
                .select("id")
                .eq("processo", r.processo)
                .limit(1);

              let bennerId: string | null = null;
              const markJudit = {
                judit_preenchido: true,
                judit_preenchido_em: new Date().toISOString(),
                judit_preenchido_por: userId,
              };
              if (existingBenner && (existingBenner as any[]).length > 0) {
                bennerId = (existingBenner as any[])[0].id;
                await supabase
                  .from("dados_benner" as any)
                  .update({ ...patch, ...markJudit } as any)
                  .eq("id", bennerId);
              } else {
                const dadoToSave: any = {
                  ...patch,
                  processo: r.processo,
                  tribunal: patch.tribunal || "TST",
                  status: "rascunho",
                  user_id: userId,
                  ...markJudit,
                };
                const { data: inserted } = await supabase
                  .from("dados_benner" as any)
                  .insert(dadoToSave)
                  .select("id")
                  .single();
                bennerId = (inserted as any)?.id || null;
              }

              if (bennerId) {
                await persistirPartesJudit(bennerId, juditData);
              }
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
          // throttle anti rate-limit (igual ao bulk)
          await new Promise((res) => setTimeout(res, 800));
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
      {!hideTrigger && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          {total > 0
            ? `Dossiês não localizados (${total})`
            : "Relatório Dossiês não localizados"}
        </Button>
      )}

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
                  Consultar Judit e preencher Dados Benner (igual ao botão Judit em lote)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, cada processo é consultado na Judit COM anexos e
                  todos os campos são gravados em Dados Benner, Partes, Anexos e
                  o registro é marcado como judit_preenchido — exatamente como o
                  botão "Preenchimento Judit em lote". Pode demorar.
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