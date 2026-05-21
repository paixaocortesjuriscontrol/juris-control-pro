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
import { CentralizadoresTab } from "./CentralizadoresTab";
import { DistribuicaoTst, DistribuicaoTstInsert } from "@/hooks/useDistribuicoesTst";
import { DadoBenner, DadoBennerInsert } from "@/hooks/useDadosBenner";
import { useAuth } from "@/contexts/AuthContext";
import { dedupeJuditAttachments } from "@/lib/juditAnexosDedup";

interface Props {
  /** Registro a editar. Quando ausente, é "novo registro" e a aba Dados Benner fica desabilitada até salvar. */
  dado?: DistribuicaoTst | null;
  /** Aba a abrir inicialmente. Default "distribuicao". */
  initialTab?: "distribuicao" | "benner" | "log-judit" | "analise-judit" | "centralizadores";
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
  const { user } = useAuth();
  const podeVerLogJudit = user?.email?.toLowerCase() === "paixaocortesjuriscontrol@gmail.com";

  const [tab, setTab] = useState<"distribuicao" | "benner" | "log-judit" | "analise-judit" | "anexos" | "centralizadores">(initialTab);
  const [anexos, setAnexos] = useState<any[] | null>(null);
  const [buscandoJudit, setBuscandoJudit] = useState(false);
  const [comAnexos, setComAnexos] = useState(false);
  // Contador ao vivo (segundos decorridos) durante a busca Judit, para o
  // usuário perceber o progresso e não achar que travou.
  const [juditElapsed, setJuditElapsed] = useState(0);
  useEffect(() => {
    if (!buscandoJudit) { setJuditElapsed(0); return; }
    const start = Date.now();
    const id = window.setInterval(() => setJuditElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [buscandoJudit]);
  const formRef = useRef<DistribuicaoTstFormHandle>(null);
  const bennerFormRef = useRef<DadosBennerFormHandle>(null);
  const [savingTop, setSavingTop] = useState(false);
  const [prontoEnviar, setProntoEnviar] = useState(false);
  const [problemaJudit, setProblemaJudit] = useState(false);

  const runJudit = async (comAnexos: boolean, forceRefresh: boolean = false) => {
    // Se o usuário está em outra aba (ex.: Anexos, Análise, Log), o form
    // de Distribuição está desmontado e formRef.current é null. Voltamos
    // para a aba "Distribuição TST" e aguardamos o React montar o form
    // antes de disparar a busca — assim o botão Judit funciona em qualquer aba.
    if (!formRef.current) {
      setTab("distribuicao");
      // Aguarda dois frames para garantir que o form remontou e registrou o ref
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (!formRef.current) return;
    }
    if (comAnexos) setAnexos([]);
    setBuscandoJudit(true);
    try {
      await formRef.current.runJudit(comAnexos, forceRefresh);
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
    const fetchList = async () => {
      const { data, error } = await supabase
        .from("judit_anexos" as any)
        .select("*")
        .eq("processo_numero", processoNumero)
        .order("attachment_date", { ascending: false });
      if (error) {
        console.warn("Erro ao carregar judit_anexos:", error.message);
        return null;
      }
      return (data as any[]) || [];
    };
    let raw = await fetchList();
    if (raw === null) return;
    // Se a lista persistida não tem `status` (registros antigos, anteriores à
    // correção), ressincroniza com o datalake da Judit para descartar anexos
    // pendentes/corrompidos que devolveriam 404 ao tentar baixar.
    const precisaSync = raw.length > 0 && raw.every((r) => r.status == null);
    if (precisaSync) {
      try {
        await supabase.functions.invoke("sincronizar-judit-anexos", {
          body: { processo_numero: processoNumero },
        });
        const fresh = await fetchList();
        if (fresh !== null) raw = fresh;
      } catch (e) {
        console.warn("Falha ao ressincronizar anexos:", e);
      }
    }
    // Esconde anexos marcados como pending/corrupted (vindos da Judit) — só
    // exibe os baixáveis. Quando `status` é null tratamos como "done" para
    // não esconder dados legados que ainda não foram ressincronizados.
    const visiveis = raw.filter((r) => {
      const status = (r.status || "done").toString().toLowerCase();
      return status === "done" && r.corrupted !== true;
    });
    const list = visiveis.map((r) => ({
      step_id: r.attachment_id,
      attachment_id: r.attachment_id,
      attachment_name: r.attachment_name,
      attachment_date: r.attachment_date,
      extension: r.extension,
      instance: r.instance,
      cnj: r.cnj,
      texto_indexado: !!r.texto_indexado,
      documento_id: r.documento_id || null,
      storage_path: r.storage_path || null,
    }));
    setAnexos(dedupeJuditAttachments(list));
  }, [processoNumero]);

  // Carrega anexos persistidos ao abrir / trocar de processo.
  useEffect(() => {
    void reloadAnexos();
  }, [reloadAnexos]);

  const [bennerDado, setBennerDado] = useState<DadoBenner | null>(null);
  const [bennerLoading, setBennerLoading] = useState(false);
  const [bennerLoaded, setBennerLoaded] = useState(false);

  // Sugestões de IA (a partir dos anexos) para destacar campos preenchidos em azul.
  const [iaDistribuicao, setIaDistribuicao] = useState<Record<string, any> | null>(null);
  const [iaBenner, setIaBenner] = useState<Record<string, any> | null>(null);
  const [iaResumo, setIaResumo] = useState<string | null>(null);

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

  // Sincroniza o switch "Problema Judit" com o registro Benner.
  useEffect(() => {
    setProblemaJudit(!!(bennerDado as any)?.problema_judit);
  }, [bennerDado]);

  // Carrega o registro Benner ao abrir o detalhe (independente da aba), para
  // que o switch "Problema Judit" reflita o valor real e o save consiga
  // localizar a linha em dados_benner.
  useEffect(() => {
    if (!bennerLoaded && processoNumero) {
      void fetchBennerByProcesso();
    }
  }, [bennerLoaded, processoNumero, fetchBennerByProcesso]);

  const handleSaveTop = async () => {
    setSavingTop(true);
    try {
      // Salva ambos os forms (Distribuição TST e Dados Benner) quando montados,
      // para que sugestões de IA aplicadas em uma aba não se percam ao salvar
      // estando em outra aba (ex.: análise quarteirizado preenchida pela IA
      // enquanto o usuário está na aba Anexos/Distribuição).
      if (formRef.current) {
        await formRef.current.save();
      }
      if (bennerFormRef.current) {
        await bennerFormRef.current.save();
      }
      // Persiste o switch "Pronto para Enviar" diretamente em dados_benner se alterado
      // (independente da aba ativa), para que o estado fique consistente em qualquer aba.
      // Só mexe no status se ele estiver em um dos estados controlados pelo switch
      // "Pronto para Enviar" (rascunho ⇄ pronto_envio). Qualquer outro status
      // (em_analise, planilhado, enviado, etc.) é preservado.
      const currentStatus = (bennerDado as any)?.status;
      const switchControlado = currentStatus === "rascunho" || currentStatus === "pronto_envio";
      if (switchControlado) {
        const desiredStatus = prontoEnviar ? "pronto_envio" : "rascunho";
        if (currentStatus !== desiredStatus && (bennerDado as any)?.id) {
          await supabase
            .from("dados_benner" as any)
            .update({ status: desiredStatus } as any)
            .eq("id", (bennerDado as any).id);
          setBennerLoaded(false);
        }
      }
      // Persiste o flag "Problema Judit" se alterado em relação ao banco.
      const currentProblema = !!(bennerDado as any)?.problema_judit;
      if (currentProblema !== problemaJudit) {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id || null;
        const payload = {
          problema_judit: problemaJudit,
          problema_judit_em: problemaJudit ? new Date().toISOString() : null,
          problema_judit_por: problemaJudit ? uid : null,
        } as any;
        const targetId = (bennerDado as any)?.id;
        const { error: updErr } = targetId
          ? await supabase.from("dados_benner" as any).update(payload).eq("id", targetId)
          : await supabase.from("dados_benner" as any).update(payload).eq("processo", processoNumero);
        if (updErr) {
          toast.error("Erro ao salvar Problema Judit: " + updErr.message);
        } else {
          setBennerLoaded(false);
        }
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
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Switch
                checked={prontoEnviar}
                onCheckedChange={setProntoEnviar}
                disabled={(bennerDado as any)?.status === "planilhado" || (bennerDado as any)?.status === "enviado"}
              />
              <Label className="text-sm font-medium">Pronto para Enviar</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={problemaJudit}
                onCheckedChange={setProblemaJudit}
              />
              <Label className="text-sm font-medium text-amber-700 dark:text-amber-400">Problema Judit</Label>
            </div>
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
            <TabsTrigger value="centralizadores" disabled={bennerDisabled}>Centralizadores</TabsTrigger>
            <TabsTrigger value="benner" disabled={bennerDisabled}>Dados Benner</TabsTrigger>
            {podeVerLogJudit && (
              <TabsTrigger value="log-judit" disabled={bennerDisabled}>Log Judit</TabsTrigger>
            )}
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
            </label>
            <Button
              variant="outline"
              onClick={() => runJudit(comAnexos, false)}
              disabled={buscandoJudit || !processoNumero}
              className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              title="Usa cache do dia quando disponível (mais rápido)"
            >
              {buscandoJudit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {buscandoJudit
                ? (juditElapsed < 3 ? "Consultando Judit…" : `Aguardando crawler… ${juditElapsed}s`)
                : "Judit"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runJudit(comAnexos, true)}
              disabled={buscandoJudit || !processoNumero}
              title="Ignora cache e força nova consulta na Judit (mais lento)"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forçar atualização
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
            iaSugestao={iaDistribuicao}
            iaResumo={iaResumo}
            onAnexosFound={(atts) => {
              const list = dedupeJuditAttachments(atts || []);
              setAnexos(list);
              // Só pula para a aba Anexos quando a Judit realmente trouxe algum
              // documento — caso contrário mantém o usuário na aba atual e o
              // toast de "sem anexos" disparado no form já dá o feedback.
              if (list.length > 0) setTab("anexos");
            }}
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
              iaSugestao={iaBenner}
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
              iaSugestao={iaBenner}
              prontoEnviar={prontoEnviar}
              onProntoEnviarChange={setProntoEnviar}
              hideFooter
            />
          )}
        </TabsContent>

        {podeVerLogJudit && (
          <TabsContent value="log-judit" className="mt-4">
            <LogJuditTab processoNumero={processoNumero} />
          </TabsContent>
        )}

        <TabsContent value="analise-judit" className="mt-4">
          <AnaliseJuditTab processoNumero={processoNumero} />
        </TabsContent>

        <TabsContent value="centralizadores" className="mt-4">
          <CentralizadoresTab
            dadoId={(bennerDado as any)?.id || (dado as any)?.id || null}
            processoNumero={processoNumero}
          />
        </TabsContent>

        <TabsContent value="anexos" className="mt-4">
          <AnexosJuditTab
            processoNumero={processoNumero}
            attachments={anexos || []}
            dadosJudit={dado ? {
              dossie: dado.dossie,
              tribunal: "TST",
              tipo_recurso: dado.tipo_recurso || dado.tipo_recurso_reclamante || dado.tipo_recurso_banco || null,
              data_distribuicao: dado.data_distribuicao_real || dado.data_distribuicao_planilha || null,
              turma: dado.turma,
              relator: dado.relator,
              recorrentes: dado.parte_recorrente
                ? dado.parte_recorrente.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
                : null,
              situacao_processo: (bennerDado as any)?.situacao_processo || dado.situacao_processo || null,
              processo_baixado: (bennerDado as any)?.processo_baixado || null,
            } : null}
            onIaPreenchido={({ distribuicao_tst, dados_benner, resumo }) => {
              setIaDistribuicao(distribuicao_tst || {});
              setIaBenner(dados_benner || {});
              setIaResumo(resumo || null);
              if (Object.keys(distribuicao_tst || {}).length > 0) {
                setTab("distribuicao");
              } else if (Object.keys(dados_benner || {}).length > 0) {
                setTab("benner");
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}