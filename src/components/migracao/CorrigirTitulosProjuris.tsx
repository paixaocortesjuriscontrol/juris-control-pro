import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function CorrigirTitulosProjuris({ coordId, nomeCoord }: { coordId: string; nomeCoord: string }) {
  const [rodando, setRodando] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [resumo, setResumo] = useState<string | null>(null);

  const corrigir = async () => {
    if (!coordId) return;
    setRodando(true); setFeitas(0); setResumo(null);
    let total = 0;
    let lote = 200;
    try {
      for (;;) {
        const { data, error } = await (supabase as any).rpc("corrigir_titulos_por_modelo_projuris", { _coordenacao_id: coordId, _limite: lote });
        if (error) {
          // Tempo limite do banco: tenta de novo com lote menor.
          if (/timeout/i.test(error.message || "") && lote > 10) { lote = Math.max(10, Math.floor(lote / 2)); continue; }
          throw error;
        }
        const n = Number(data) || 0;
        total += n; setFeitas(total);
        if (n === 0) break;
      }
      setResumo(`${total.toLocaleString("pt-BR")} tarefas corrigidas em ${nomeCoord}.`);
      toast.success("Títulos corrigidos");
    } catch (e: any) {
      setResumo(`Parou após ${total.toLocaleString("pt-BR")} tarefas: ${e.message || "erro"}`);
      toast.error(e.message || "Falha ao corrigir títulos");
    }
    setRodando(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corrigir títulos das tarefas migradas</CardTitle>
        <CardDescription>
          Não precisa enviar arquivos. Nas tarefas do Projuris da coordenação selecionada ({nomeCoord || "nenhuma"}), o título passa a ser o nome do tipo de tarefa e o título antigo vai para a descrição. Tarefas sem tipo ficam como estão.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button disabled={!coordId || rodando} onClick={corrigir}>
          {rodando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {rodando ? `Corrigindo... ${feitas.toLocaleString("pt-BR")}` : "Corrigir títulos"}
        </Button>
        {resumo && <p className="text-sm">{resumo}</p>}
      </CardContent>
    </Card>
  );
}
