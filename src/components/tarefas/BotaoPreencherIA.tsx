import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { tipoTarefaToTipoItem, type TipoItemPromptIa } from "@/constants/promptsIaPublicacoes";
interface BotaoPreencherIAProps {
  conteudo: string | null | undefined;
  tipoTarefa?: string;
  tipoItem?: TipoItemPromptIa;
  coordenacaoId?: string | null;
  processoNumero?: string | null;
  dataPublicacao?: string | null;
  onResultado: (resultado: {
    tipo_tarefa?: string;
    titulo: string;
    descricao: string;
    prioridade: "baixa" | "media" | "alta" | "urgente";
    data_vencimento: string;
    observacoes?: string;
  }) => void;
  disabled?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function BotaoPreencherIA({
  conteudo,
  tipoTarefa,
  tipoItem,
  coordenacaoId,
  processoNumero,
  dataPublicacao,
  onResultado,
  disabled,
  size = "default",
  variant = "outline",
}: BotaoPreencherIAProps) {
  const [loading, setLoading] = useState(false);

  const getFunctionErrorMessage = async (error: any) => {
    const fallback = error?.message || "Erro ao analisar publicação";
    const context = error?.context;
    if (!context || typeof context.text !== "function") return fallback;

    try {
      const details = await context.text();
      if (!details) return fallback;
      try {
        const parsed = JSON.parse(details);
        return parsed?.error || parsed?.message || fallback;
      } catch {
        return details.slice(0, 500);
      }
    } catch {
      return fallback;
    }
  };

  const handleClick = async () => {
    if (!conteudo) {
      toast.error("Não há conteúdo para analisar");
      return;
    }

    setLoading(true);
    try {
      const tipoItemFinal: TipoItemPromptIa = tipoItem ?? tipoTarefaToTipoItem(tipoTarefa);
      const { data, error } = await supabase.functions.invoke("analisar-publicacao-ia", {
        body: {
          conteudo,
          tipoTarefa,
          tipoItem: tipoItemFinal,
          coordenacaoId: coordenacaoId ?? null,
          processoNumero,
          dataPublicacao,
        },
      });

      if (error) {
        throw new Error(await getFunctionErrorMessage(error));
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.titulo) {
        throw new Error("A IA não retornou os campos da tarefa");
      }

      onResultado({
        tipo_tarefa: data.tipo_tarefa,
        titulo: data.titulo,
        descricao: data.descricao,
        prioridade: data.prioridade,
        data_vencimento: data.data_vencimento,
        observacoes: data.observacoes,
      });

      toast.success("Campos preenchidos pela IA!", {
        description: data.observacoes || "Revise os dados antes de salvar.",
      });
    } catch (error) {
      console.error("Erro ao analisar com IA:", error);
      const message = error instanceof Error ? error.message : "Erro ao analisar publicação";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || loading || !conteudo}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
      {size !== "icon" && (loading ? "Analisando..." : "Preencher com IA")}
    </Button>
  );
}
