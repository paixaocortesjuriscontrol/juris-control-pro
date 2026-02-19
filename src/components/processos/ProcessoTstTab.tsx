import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Save, Loader2, Gavel, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrlOrEmpty } from "@/utils/signedUrl";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { toast as sonnerToast } from "sonner";

interface ProcessoTstTabProps {
  processo: any;
}

export function ProcessoTstTab({ processo }: ProcessoTstTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState("");
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [form, setForm] = useState({
    dossie_tst: "",
    equipe_tst: "",
    relator_tst: "",
    relator_favorabilidade: "",
    turma_tst: "",
    turma_favorabilidade: "",
    parte_recorrente_tst: "",
    tipo_recurso_reclamante: "",
    materias_recurso_reclamante: "",
    aparelhamento_reclamante: "",
    chance_exito_reclamante: "",
    tipo_recurso_banco: "",
    materias_recurso_banco: "",
    aparelhamento_banco: "",
    chance_exito_banco: "",
    honra_tst: "",
    tema_tst: "",
    execucao_tst: "",
    midia_negativa_tst: "",
    decisao_quarteirizado: "",
    recurso_terceiros_tst: "",
    resumo_ia_tst: "",
    status_tst: "",
    transito_julgado_tst: "",
    sugestao_providencia_tst: "",
    benner_atualizado: false,
  });

  useEffect(() => {
    if (processo) {
      setForm({
        dossie_tst: processo.dossie_tst || "",
        equipe_tst: processo.equipe_tst || "",
        relator_tst: processo.relator_tst || "",
        relator_favorabilidade: processo.relator_favorabilidade || "",
        turma_tst: processo.turma_tst || "",
        turma_favorabilidade: processo.turma_favorabilidade || "",
        parte_recorrente_tst: processo.parte_recorrente_tst || "",
        tipo_recurso_reclamante: processo.tipo_recurso_reclamante || "",
        materias_recurso_reclamante: processo.materias_recurso_reclamante || "",
        aparelhamento_reclamante: processo.aparelhamento_reclamante || "",
        chance_exito_reclamante: processo.chance_exito_reclamante || "",
        tipo_recurso_banco: processo.tipo_recurso_banco || "",
        materias_recurso_banco: processo.materias_recurso_banco || "",
        aparelhamento_banco: processo.aparelhamento_banco || "",
        chance_exito_banco: processo.chance_exito_banco || "",
        honra_tst: processo.honra_tst || "",
        tema_tst: processo.tema_tst || "",
        execucao_tst: processo.execucao_tst || "",
        midia_negativa_tst: processo.midia_negativa_tst || "",
        decisao_quarteirizado: processo.decisao_quarteirizado || "",
        recurso_terceiros_tst: processo.recurso_terceiros_tst || "",
        resumo_ia_tst: processo.resumo_ia_tst || "",
        status_tst: processo.status_tst || "",
        transito_julgado_tst: processo.transito_julgado_tst || "",
        sugestao_providencia_tst: processo.sugestao_providencia_tst || "",
        benner_atualizado: processo.benner_atualizado || false,
      });
    }
  }, [processo]);

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const extractAndIndexDocuments = async (processoId: string): Promise<number> => {
    // Fetch documents for this process
    const { data: docs } = await supabase
      .from("documentos")
      .select("id, nome, tipo, url, texto_completo_indexado")
      .eq("processo_id", processoId)
      .order("created_at", { ascending: false });

    if (!docs || docs.length === 0) {
      throw new Error("Nenhum documento encontrado na aba Pasta. Envie documentos primeiro.");
    }

    const docsToIndex = docs.filter(d => !d.texto_completo_indexado);
    const pdfDocs = docsToIndex.filter(d => 
      ((d.tipo || "").includes("pdf") || d.nome?.toLowerCase().endsWith(".pdf")) && d.url
    );

    if (pdfDocs.length === 0 && docs.every(d => !d.texto_completo_indexado)) {
      throw new Error("Nenhum documento PDF encontrado na aba Pasta. Envie documentos PDF primeiro.");
    }

    let indexed = 0;
    let lastError = "";

    for (let di = 0; di < pdfDocs.length; di++) {
      const doc = pdfDocs[di];

      setAnalyzeStatus(`Extraindo texto: ${doc.nome} (${di + 1}/${pdfDocs.length})`);
      setAnalyzeProgress(Math.round(((di) / pdfDocs.length) * 40));

      try {
        let arrayBuffer: ArrayBuffer;
        const response = await fetch(doc.url!);
        if (!response.ok) {
          // URL may be stale — try to find the file in storage by listing the folder
          const urlParts = doc.url!.split("/documentos_processos/");
          if (urlParts.length === 2) {
            const pathSegments = urlParts[1].split("/");
            const folder = pathSegments.slice(0, -1).join("/");
            const { data: files } = await supabase.storage
              .from("documentos_processos")
              .list(folder, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
            
            const match = files?.find(f => f.name.includes(doc.nome?.replace(/^\d+_/, "") || "___"));
            if (match) {
              const correctPath = folder ? `${folder}/${match.name}` : match.name;
              const { data: dlData, error: dlError } = await supabase.storage
                .from("documentos_processos")
                .download(correctPath);
              if (dlError || !dlData) throw new Error(`Falha ao baixar PDF do storage: ${dlError?.message}`);
              arrayBuffer = await dlData.arrayBuffer();
              
              // Fix the stale URL for future use
              const signedUrl = await getSignedUrlOrEmpty("documentos_processos", correctPath);
              if (signedUrl) {
                await supabase.from("documentos").update({ url: signedUrl } as any).eq("id", doc.id);
              }
            } else {
              throw new Error(`Arquivo não encontrado no storage (status ${response.status})`);
            }
          } else {
            throw new Error(`Falha ao baixar PDF (status ${response.status})`);
          }
        } else {
          const blob = await response.blob();
          arrayBuffer = blob.arrayBuffer ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer();
        }

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const allPageTexts: string[] = [];
        const batchSize = 20;
        for (let start = 1; start <= pdf.numPages; start += batchSize) {
          const end = Math.min(start + batchSize - 1, pdf.numPages);
          const rows: { documento_id: string; processo_id: string; pagina: number; conteudo_texto: string }[] = [];

          for (let i = start; i <= end; i++) {
            const page = await pdf.getPage(i);
            const tc = await page.getTextContent();
            const text = tc.items.map((item: any) => item.str).join(" ");
            if (text.trim()) {
              rows.push({
                documento_id: doc.id,
                processo_id: processoId,
                pagina: i,
                conteudo_texto: text.trim(),
              });
              allPageTexts.push(`--- Página ${i} ---\n${text.trim()}`);
            }
          }

          if (rows.length > 0) {
            await supabase.from("documentos_texto_indexado" as any).upsert(rows as any, {
              onConflict: "documento_id,pagina",
            });
          }

          setAnalyzeProgress(Math.round(((di + (end / pdf.numPages)) / pdfDocs.length) * 40));
        }

        // Mark document as fully indexed
        await supabase.from("documentos").update({
          texto_completo_indexado: true,
          conteudo_extraido: allPageTexts.join("\n\n").substring(0, 60000),
          paginas_extraidas: pdf.numPages,
        } as any).eq("id", doc.id);

        indexed++;
      } catch (e: any) {
        lastError = e.message || String(e);
        console.error(`Erro ao indexar ${doc.nome}:`, e);
      }
    }

    const totalIndexed = docs.filter(d => d.texto_completo_indexado).length + indexed;
    if (totalIndexed === 0 && lastError) {
      throw new Error(`Erro ao processar PDF: ${lastError}`);
    }
    return totalIndexed;
  };

  const handleAnalyzeIA = async () => {
    if (!processo?.id) return;
    setAnalyzing(true);
    setAnalyzeProgress(0);
    setAnalyzeStatus("Verificando documentos...");
    try {
      // Step 1: Extract and index documents if needed
      const totalIndexed = await extractAndIndexDocuments(processo.id);
      if (totalIndexed === 0) {
        throw new Error("Nenhum documento PDF pôde ser indexado.");
      }

      // Step 2: Call the AI analysis edge function
      setAnalyzeStatus("Enviando para análise IA...");
      setAnalyzeProgress(50);

      const { data, error } = await supabase.functions.invoke("analisar-tst-ia", {
        body: { processoId: processo.id },
      });

      setAnalyzeProgress(90);

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const campos = data.campos || {};
      const count = Object.keys(campos).length;

      if (count === 0) {
        sonnerToast.warning("A IA não conseguiu extrair campos TST dos documentos anexados.");
        return;
      }

      // Also set resumo_ia_tst from observacoes
      const resumo = data.observacoes || "";
      setForm(prev => ({ ...prev, ...campos, resumo_ia_tst: resumo || prev.resumo_ia_tst }));
      setAnalyzeProgress(100);
      sonnerToast.success(`${count} campos preenchidos pela IA!`, {
        description: data.observacoes || `${data.documentos_analisados} documento(s) analisado(s). Revise antes de salvar.`,
      });
    } catch (err: any) {
      console.error("Erro na análise TST IA:", err);
      sonnerToast.error(err.message || "Erro ao analisar com IA");
    } finally {
      setAnalyzing(false);
      setAnalyzeStatus("");
      setAnalyzeProgress(0);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      const textFields = [
        "dossie_tst", "equipe_tst", "relator_tst", "relator_favorabilidade",
        "turma_tst", "turma_favorabilidade", "parte_recorrente_tst",
        "tipo_recurso_reclamante", "materias_recurso_reclamante", "aparelhamento_reclamante",
        "chance_exito_reclamante", "tipo_recurso_banco", "materias_recurso_banco",
        "aparelhamento_banco", "chance_exito_banco", "honra_tst", "tema_tst",
        "execucao_tst", "midia_negativa_tst", "decisao_quarteirizado", "recurso_terceiros_tst",
        "resumo_ia_tst", "status_tst", "transito_julgado_tst", "sugestao_providencia_tst",
      ];

      textFields.forEach(field => {
        const newVal = form[field as keyof typeof form] || null;
        const oldVal = processo[field] || null;
        if (newVal !== oldVal) updates[field] = newVal === "" ? null : newVal;
      });

      if (form.benner_atualizado !== (processo.benner_atualizado || false)) {
        updates.benner_atualizado = form.benner_atualizado;
      }

      if (Object.keys(updates).length === 0) {
        toast({ title: "Nenhuma alteração detectada" });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("processos")
        .update(updates as any)
        .eq("id", processo.id);

      if (error) throw error;

      toast({ title: "Dados TST salvos com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["processo", processo.id] });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const InputField = ({ label, field }: { label: string; field: string; textarea?: boolean }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Textarea
        value={form[field as keyof typeof form] as string}
        onChange={e => handleChange(field, e.target.value)}
        className="min-h-[40px] resize-none overflow-hidden"
        style={{ height: "auto" }}
        ref={(el) => {
          if (el) {
            el.style.height = "auto";
            el.style.height = Math.max(40, el.scrollHeight) + "px";
          }
        }}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Gavel className="w-5 h-5" />
          Dados TST
        </h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleAnalyzeIA}
            disabled={analyzing || !processo?.id}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {analyzing ? "Analisando..." : "Preencher com IA"}
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Progress bar during analysis */}
      {analyzing && (
        <div className="space-y-2 rounded-lg border p-4 bg-muted/20">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{analyzeStatus}</span>
            <span className="font-medium">{analyzeProgress}%</span>
          </div>
          <Progress value={analyzeProgress} className="h-2" />
        </div>
      )}

      {/* Info do Processo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border p-4 bg-muted/30">
        <div>
          <span className="text-xs font-medium text-muted-foreground">Número do Processo</span>
          <p className="font-mono font-semibold text-sm">{processo?.numero || "—"}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">Data de Distribuição</span>
          <p className="font-semibold text-sm">{processo?.data_distribuicao || "—"}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">Reclamante</span>
          <p className="font-semibold text-sm">{processo?.polo_ativo || "—"}</p>
        </div>
      </div>

      {/* Resumo IA - acima dos Dados Básicos, auto-resize */}
      {form.resumo_ia_tst && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Resumo IA</Label>
          <Textarea
            value={form.resumo_ia_tst}
            onChange={e => handleChange("resumo_ia_tst", e.target.value)}
            className="min-h-[60px] resize-none overflow-hidden"
            style={{ height: "auto" }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }
            }}
          />
        </div>
      )}

      {/* Dados Básicos */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">Dados Básicos</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField label="Dossiê" field="dossie_tst" />
          <InputField label="Equipe" field="equipe_tst" />
          <InputField label="Relator" field="relator_tst" />
          <InputField label="Relator (+ ou -)" field="relator_favorabilidade" />
          <InputField label="Turma" field="turma_tst" />
          <InputField label="Turma (+ ou -)" field="turma_favorabilidade" />
          <InputField label="Parte Recorrente" field="parte_recorrente_tst" />
        </div>
      </div>

      {/* Recurso do Reclamante */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">Recurso do Reclamante</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="Tipo de Recurso" field="tipo_recurso_reclamante" />
          <InputField label="Matérias" field="materias_recurso_reclamante" textarea />
          <InputField label="Aparelhamento" field="aparelhamento_reclamante" />
          <InputField label="Chance de Êxito" field="chance_exito_reclamante" />
        </div>
      </div>

      {/* Recurso do Banco */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">Recurso do Banco</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="Tipo de Recurso" field="tipo_recurso_banco" />
          <InputField label="Matérias" field="materias_recurso_banco" textarea />
          <InputField label="Aparelhamento" field="aparelhamento_banco" />
          <InputField label="Chance de Êxito" field="chance_exito_banco" />
        </div>
      </div>


      {/* Análise e Status */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">Análise e Status</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField label="Honra" field="honra_tst" />
          <InputField label="Tema" field="tema_tst" />
          <InputField label="Execução" field="execucao_tst" />
          <InputField label="Mídia Negativa" field="midia_negativa_tst" />
          <InputField label="Decisão (Quarteirizado)" field="decisao_quarteirizado" textarea />
          <InputField label="Recurso de Terceiros" field="recurso_terceiros_tst" />
          <InputField label="Status TST" field="status_tst" />
          <InputField label="Trânsito em Julgado" field="transito_julgado_tst" />
          <InputField label="Sugestão de Providência" field="sugestao_providencia_tst" />
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-xs font-medium text-muted-foreground">Benner Atualizado?</Label>
            <Switch
              checked={form.benner_atualizado}
              onCheckedChange={v => handleChange("benner_atualizado", v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
