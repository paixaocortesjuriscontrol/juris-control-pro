import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BotaoPreencherIAProps {
  conteudo: string | null | undefined;
  tipoTarefa?: string;
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
  processoNumero,
  dataPublicacao,
  onResultado,
  disabled,
  size = "default",
  variant = "outline",
}: BotaoPreencherIAProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!conteudo) {
      toast.error("Não há conteúdo para analisar");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analisar-publicacao-ia", {
        body: {
          conteudo,
          tipoTarefa,
          processoNumero,
          dataPublicacao,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
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
    <Tooltip>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent>
        <p>Usar IA para preencher automaticamente os campos da tarefa</p>
      </TooltipContent>
    </Tooltip>
  );
}
