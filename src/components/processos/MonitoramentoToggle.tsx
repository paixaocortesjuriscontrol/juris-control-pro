import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MonitoramentoToggleProps {
  processoId: string;
  campo: "monitorar_andamentos" | "monitorar_djen";
  valorInicial?: boolean;
}

export function MonitoramentoToggle({ processoId, campo, valorInicial = false }: MonitoramentoToggleProps) {
  const [ativo, setAtivo] = useState(valorInicial);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    try {
      const updateData = { [campo]: checked };
      
      const { error } = await supabase
        .from("processos")
        .update(updateData)
        .eq("id", processoId);

      if (error) throw error;

      setAtivo(checked);
      toast({
        title: checked ? "Monitoramento ativado" : "Monitoramento desativado",
        description: campo === "monitorar_andamentos" 
          ? "Busca de andamentos atualizada com sucesso"
          : "Busca DJEN atualizada com sucesso",
      });
    } catch (err) {
      console.error("Erro ao atualizar monitoramento:", err);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o monitoramento",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Switch
      checked={ativo}
      onCheckedChange={handleToggle}
      disabled={isLoading}
    />
  );
}
