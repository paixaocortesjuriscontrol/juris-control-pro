import { useEffect, useState, useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Search, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DistribuicaoTstForm, DistribuicaoTstFormHandle } from "./DistribuicaoTstForm";
import { DadosBennerForm, DadosBennerFormHandle } from "@/components/benner/DadosBennerForm";
import { LogJuditTab } from "./LogJuditTab";
import { AnaliseJuditTab } from "./AnaliseJuditTab";
import { AnexosJuditTab } from "./AnexosJuditTab";
import { DistribuicaoTst, DistribuicaoTstInsert } from "@/hooks/useDistribuicoesTst";
import { DadoBenner, DadoBennerInsert } from "@/hooks/useDadosBenner";

interface Props {
  /** Registro a editar. Quando ausente, é "novo registro" e a aba Dados Benner fica desabilitada até salvar. */
  dado?: DistribuicaoTst | null;
  /** Aba a abrir inicialmente. Default "distribuicao". */
  initialTab?: "distribuicao" | "benner" | "log-judit" | "analise-judit";
  onSaveDistribuicao: (dado: DistribuicaoTstInsert, id?: string) => Promise<boolean | string>;
  onSaveBenner: (dado: DadoBennerInsert, id?: string) => Promise<boolean | string>;
  onClose: () => void;
  /** Disparado após auto-save do botão Judit para que o parent recarregue
   *  a referência de `dado` e mantenha o destaque verde após sair/voltar.
   *  Quando o auto-save criou um novo registro, recebe o `newId` para que o
   *  parent possa popular `editando` e habilitar as abas dependentes. */
  onAfterJuditSync?: (newId?: string) => void | Promise<void>;
}

/**
 * Detalhe unificado para a tela "Distribuição TST" — exibe duas abas para o
 * mesmo processo (mesma linha de dados_benner):
 *   1) Distribuição TST  (DistribuicaoTstForm)
 *   2) Dados Benner       (DadosBennerForm)
 *
 * Evita que o usuário precise voltar à lista para alternar entre as visões.
 */
export function DistribuicaoTstDetail({ dado, initialTab = "distribuicao", onSaveDistribuicao, onSaveBenner, onClose, onAfterJuditSync }: Props) {
  const processoNumero = dado?.processo_numero || "";

  const [tab, setTab] = useState<"distribuicao" | "benner" | "log-judit" | "analise-judit" | "anexos">(initialTab);
  const [anexos, setAnexos] = useState<any[] | null>(null);
  const [buscandoJudit, setBuscandoJudit] = useState(false);
  const [comAnexos, setComAnexos] = useState(false);
  const formRef = useRef<DistribuicaoTstFormHandle>(null);
  const bennerFormRef = useRef<DadosBennerFormHandle>(null);
  const [savingTop, setSavingTop] = useState(false);
  const [prontoEnviar, setProntoEnviar] = useState(false);

  const runJudit = async (comAnexos: boolean) => {
    if (!formRef.current) return;
    if (comAnexos) setAnexos([]);
    setBuscandoJudit(true);
    try {
      await formRef.current.runJudit(comAnexos);
      if (comAnexos) {
        // Após a busca, recarrega do Supabase para refletir o que foi persistido.
        await reloadAnexos();
      }
    } finally {
      setBuscandoJudit(false);
    }
  };

  // Sempre abre o detalhe no topo do formulário (evita herdar scroll da lista).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.querySelector<HTMLElement>("[data-page-scroll-container]")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [dado?.id, initialTab]);

  const reloadAnexos = useCallback(async () => {
    if (!processoNumero) return;
    const { data, error } = await supabase
      .from("judit_anexos" as any)
      .select("*")
      .eq("processo_numero", processoNumero)
      .order("attachment_date", { ascending: false });
    if (error) {
      console.warn("Erro ao carregar judit_anexos:", error.message);
      return;
    }
    const list = ((data as any[]) || []).map((r) => ({
      step_id: r.attachment_id,
      attachment_name: r.attachment_name,
      attachment_date: r.attachment_date,
      extension: r.extension,
      instance: r.instance,
      cnj: r.cnj,
    }));
    setAnexos(list);
  }, [processoNumero]);

  // Carrega anexos persistidos ao abrir / trocar de processo.
  useEffect(() => {
    void reloadAnexos();
  }, [reloadAnexos]);

  const [bennerDado, setBennerDado] = useState<DadoBenner | null>(null);
  const [bennerLoading, setBennerLoading] = useState(false);
  const [bennerLoaded, setBennerLoaded] = useState(false);

  const fetchBennerByProcesso = useCallback(async () => {
    if (!processoNumero) {
      setBennerDado(null);
      setBennerLoaded(true);
      return;
    }
    setBennerLoading(true);
    const { data, error } = await supabase
      .from("dados_benner" as any)
      .select("*")
      .eq("processo", processoNumero)
      .limit(1);
    if (error) {
      toast.error("Erro ao carregar Dados Benner: " + error.message);
    }
    const row = ((data as any[]) || [])[0] || null;
    setBennerDado(row as DadoBenner | null);
    setBennerLoaded(true);
    setBennerLoading(false);
  }, [processoNumero]);

  // Carrega o registro Benner quando a aba Benner é aberta pela primeira vez.
  useEffect(() => {
    if (tab === "benner" && !bennerLoaded && processoNumero) {
      void fetchBennerByProcesso();
    }
  }, [tab, bennerLoaded, processoNumero, fetchBennerByProcesso]);

  const handleSaveDistribuicaoLocal = async (d: DistribuicaoTstInsert, id?: string) => {
    const ok = await onSaveDistribuicao(d, id);
    // Após salvar Distribuição, invalida o cache do Benner para refletir mudanças
    // (mesma linha de dados_benner é compartilhada).
    if (ok) setBennerLoaded(false);
    return ok;
  };

  const handleSaveBennerLocal = async (d: DadoBennerInsert, id?: string) => {
    const result = await onSaveBenner(d, id);
    if (result) setBennerLoaded(false);
    return result;
  };

  /**
   * Disparado pelos forms após auto-save do Judit. Força recarga do registro
   * Benner para que a aba paralela exiba imediatamente os campos preenchidos.
   */
  const handleJuditSync = useCallback((newId?: string) => {
    setBennerLoaded(false);
    if (processoNumero) {
      void fetchBennerByProcesso();
    }
    void onAfterJuditSync?.(newId);
  }, [processoNumero, fetchBennerByProcesso, onAfterJuditSync]);

  const titulo = processoNumero ? `Processo ${processoNumero}` : "Novo registro";
  const bennerDisabled = !processoNumero;

  // Sincroniza o switch "Pronto para Enviar" do header com o status atual do registro Benner.
  useEffect(() => {
    setProntoEnviar((bennerDado as any)?.status === "pronto_envio");
  }, [bennerDado]);

  const handleSaveTop = async () => {
    setSavingTop(true);
    try {
      // Salva o form da aba ativa. Para Distribuição/Benner, dispara o handler interno do form.
      if (tab === "benner" && bennerFormRef.current) {
        await bennerFormRef.current.save();
      } else if (formRef.current) {
        await formRef.current.save();
      }
    } finally {
      setSavingTop(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar à lista
        </Button>
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={prontoEnviar}
              onCheckedChange={setProntoEnviar}
              disabled={(bennerDado as any)?.status === "planilhado" || (bennerDado as any)?.status === "enviado"}
            />
            <Label className="text-sm font-medium">Pronto para Enviar</Label>
          </div>
          <Button onClick={handleSaveTop} disabled={savingTop}>
            {savingTop ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList className="justify-start">
            <TabsTrigger value="distribuicao">Distribuição TST</TabsTrigger>
            <TabsTrigger value="benner" disabled={bennerDisabled}>Dados Benner</TabsTrigger>
            <TabsTrigger value="log-judit" disabled={bennerDisabled}>Log Judit</TabsTrigger>
            <TabsTrigger value="analise-judit" disabled={bennerDisabled}>Análise Judit</TabsTrigger>
            {anexos && (
              <TabsTrigger value="anexos">Anexos ({anexos.length})</TabsTrigger>
            )}
          </TabsList>
          <div className="flex items-center gap-3">
            <label
              className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none"
              title="Inclui a lista de documentos/anexos do processo (consulta mais cara)."
            >
              <Checkbox
                checked={comAnexos}
                onCheckedChange={(v) => setComAnexos(v === true)}
                disabled={buscandoJudit}
              />
              Com anexos
              <span className="text-[10px] text-amber-600 dark:text-amber-400">(caro)</span>
            </label>
            <Button
              variant="outline"
              onClick={() => runJudit(comAnexos)}
              disabled={buscandoJudit || !processoNumero}
              className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            >
              {buscandoJudit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Judit
            </Button>
          </div>
        </div>

        <TabsContent value="distribuicao" className="mt-4">
          <DistribuicaoTstForm
            ref={formRef}
            dado={dado || null}
            onSave={handleSaveDistribuicaoLocal}
            onCancel={onClose}
            onJuditSync={handleJuditSync}
            onAnexosFound={(atts) => { setAnexos(atts || []); setTab("anexos"); }}
          />
        </TabsContent>

        <TabsContent value="benner" className="mt-4">
          {bennerLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : bennerDado ? (
            <DadosBennerForm
              ref={bennerFormRef}
              dado={bennerDado}
              markExistingJuditFields={!!(bennerDado as any)?.judit_preenchido}
              onSave={handleSaveBennerLocal}
              onCancel={onClose}
              onJuditSync={handleJuditSync}
              prontoEnviar={prontoEnviar}
              onProntoEnviarChange={setProntoEnviar}
              hideFooter
            />
          ) : (
            <DadosBennerForm
              ref={bennerFormRef}
              initialData={{
                processo: processoNumero,
                dossie: dado?.dossie || "",
                turma: dado?.turma || "",
                relator: dado?.relator || "",
                tribunal: "TST",
                data_distribuicao: dado?.data_distribuicao_real || dado?.data_distribuicao_planilha || null,
                recorrente: dado?.parte_recorrente || "",
                status: "rascunho",
              } as Partial<DadoBennerInsert>}
              onSave={handleSaveBennerLocal}
              onCancel={onClose}
              onJuditSync={handleJuditSync}
              prontoEnviar={prontoEnviar}
              onProntoEnviarChange={setProntoEnviar}
              hideFooter
            />
          )}
        </TabsContent>

        <TabsContent value="log-judit" className="mt-4">
          <LogJuditTab processoNumero={processoNumero} />
        </TabsContent>

        <TabsContent value="analise-judit" className="mt-4">
          <AnaliseJuditTab processoNumero={processoNumero} />
        </TabsContent>

        <TabsContent value="anexos" className="mt-4">
          <AnexosJuditTab
            processoNumero={processoNumero}
            attachments={anexos || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}