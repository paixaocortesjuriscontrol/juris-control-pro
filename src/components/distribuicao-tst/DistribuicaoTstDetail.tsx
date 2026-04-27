import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DistribuicaoTstForm } from "./DistribuicaoTstForm";
import { DadosBennerForm } from "@/components/benner/DadosBennerForm";
import { DistribuicaoTst, DistribuicaoTstInsert } from "@/hooks/useDistribuicoesTst";
import { DadoBenner, DadoBennerInsert } from "@/hooks/useDadosBenner";

interface Props {
  /** Registro a editar. Quando ausente, é "novo registro" e a aba Dados Benner fica desabilitada até salvar. */
  dado?: DistribuicaoTst | null;
  /** Aba a abrir inicialmente. Default "distribuicao". */
  initialTab?: "distribuicao" | "benner";
  onSaveDistribuicao: (dado: DistribuicaoTstInsert, id?: string) => Promise<boolean>;
  onSaveBenner: (dado: DadoBennerInsert, id?: string) => Promise<boolean | string>;
  onClose: () => void;
}

/**
 * Detalhe unificado para a tela "Distribuição TST" — exibe duas abas para o
 * mesmo processo (mesma linha de dados_benner):
 *   1) Distribuição TST  (DistribuicaoTstForm)
 *   2) Dados Benner       (DadosBennerForm)
 *
 * Evita que o usuário precise voltar à lista para alternar entre as visões.
 */
export function DistribuicaoTstDetail({ dado, initialTab = "distribuicao", onSaveDistribuicao, onSaveBenner, onClose }: Props) {
  const processoNumero = dado?.processo_numero || "";

  const [tab, setTab] = useState<"distribuicao" | "benner">(initialTab);
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

  const titulo = processoNumero ? `Processo ${processoNumero}` : "Novo registro";
  const bennerDisabled = !processoNumero;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar à lista
        </Button>
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "distribuicao" | "benner")} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="distribuicao">Distribuição TST</TabsTrigger>
          <TabsTrigger value="benner" disabled={bennerDisabled}>
            Dados Benner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="distribuicao" className="mt-4">
          <DistribuicaoTstForm
            dado={dado || null}
            onSave={handleSaveDistribuicaoLocal}
            onCancel={onClose}
          />
        </TabsContent>

        <TabsContent value="benner" className="mt-4">
          {bennerLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : bennerDado ? (
            <DadosBennerForm
              dado={bennerDado}
              markExistingJuditFields={!!(bennerDado as any)?.judit_preenchido}
              onSave={handleSaveBennerLocal}
              onCancel={onClose}
            />
          ) : (
            <DadosBennerForm
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
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}