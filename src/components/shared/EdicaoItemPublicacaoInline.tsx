import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { NovaTarefaDialog } from "@/components/delegacao/NovaTarefaDialog";
import { PrazoDialog } from "@/components/prazos/PrazoDialog";
import { EventoDialog } from "@/components/agenda/EventoDialog";
import { EditarAudienciaDialog } from "@/components/audiencias/EditarAudienciaDialog";
import type { ItemCriadoTipo } from "@/components/shared/ItensCriadosPublicacaoCard";

interface Props {
  tipo: ItemCriadoTipo;
  id: string;
  onClose: () => void;
}

/**
 * Carrega o registro correspondente ao item clicado no card verde
 * ("Itens criados a partir desta publicação") e renderiza, inline,
 * o formulário de edição adequado ao tipo.
 */
export function EdicaoItemPublicacaoInline({ tipo, id, onClose }: Props) {
  const [registro, setRegistro] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      const tabela =
        tipo === "evento" ? "eventos_agenda" : tipo === "audiencia" ? "audiencias_detectadas" : "tarefas";
      const { data } = await (supabase as any).from(tabela).select("*").eq("id", id).maybeSingle();
      if (cancelado) return;
      setRegistro(data ?? null);
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [tipo, id]);

  if (carregando) {
    return (
      <div className="rounded-md border bg-background p-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando item...
      </div>
    );
  }

  if (!registro) {
    return (
      <div className="rounded-md border bg-background p-6 text-sm text-muted-foreground text-center">
        Item não encontrado (pode ter sido removido).
      </div>
    );
  }

  const handleOpenChange = (aberto: boolean) => {
    if (!aberto) onClose();
  };

  if (tipo === "audiencia") {
    return (
      <div className="rounded-md border bg-background overflow-hidden">
        <EditarAudienciaDialog audiencia={registro} open inline onOpenChange={handleOpenChange} />
      </div>
    );
  }

  if (tipo === "evento") {
    return (
      <div className="rounded-md border bg-background overflow-hidden">
        <EventoDialog inline open onOpenChange={handleOpenChange} evento={registro} />
      </div>
    );
  }

  if (tipo === "prazo") {
    return (
      <div className="rounded-md border bg-background overflow-hidden">
        <PrazoDialog inline open onOpenChange={handleOpenChange} prazo={registro} />
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-background overflow-hidden">
      <NovaTarefaDialog
        inline
        open
        onOpenChange={handleOpenChange}
        coordenacoes={[]}
        tarefaParaEditar={registro}
      />
    </div>
  );
}
