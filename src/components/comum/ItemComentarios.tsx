import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { MencaoTextarea, ConteudoComMencoes } from "@/components/comum/MencaoTextarea";
import { useMembrosMencionaveis } from "@/hooks/useMembrosMencionaveis";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Trash2, MessageSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Tipo = "tarefa" | "evento" | "audiencia";

interface Config {
  table: "comentarios_tarefas" | "comentarios_eventos" | "comentarios_audiencias";
  fk: "tarefa_id" | "evento_id" | "audiencia_id";
}

const CONFIG: Record<Tipo, Config> = {
  tarefa: { table: "comentarios_tarefas", fk: "tarefa_id" },
  evento: { table: "comentarios_eventos", fk: "evento_id" },
  audiencia: { table: "comentarios_audiencias", fk: "audiencia_id" },
};

interface Props {
  tipo: Tipo;
  itemId: string | null | undefined;
  className?: string;
}

interface Comentario {
  id: string;
  autor_id: string;
  conteudo: string;
  created_at: string;
  autor?: { id: string; nome: string } | null;
}

export function ItemComentarios({ tipo, itemId, className }: Props) {
  const [novo, setNovo] = useState("");
  const [mencionados, setMencionados] = useState<string[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { table, fk } = CONFIG[tipo];
  const { membros } = useMembrosMencionaveis();

  const queryKey = ["item-comentarios", tipo, itemId];

  const { data: comentarios, isLoading } = useQuery({
    queryKey,
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select(`id, autor_id, conteudo, created_at`)
        .eq(fk, itemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const autorIds = [...new Set((data as any[]).map((c) => c.autor_id))];
      const { data: profiles } = await supabase
        .from("profiles_basic")
        .select("id, nome")
        .in("id", autorIds as string[]);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (data as any[]).map((c) => ({
        ...c,
        autor: map.get(c.autor_id) || null,
      })) as Comentario[];
    },
  });

  const addMut = useMutation({
    mutationFn: async (conteudo: string) => {
      if (!user || !itemId) throw new Error("Salve o item antes de comentar");
      const payload: any = { autor_id: user.id, conteudo, mencionados, [fk]: itemId };
      const { error } = await (supabase as any).from(table).insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setNovo("");
      setMencionados([]);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao enviar comentário", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast({ title: "Comentário excluído" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao excluir comentário", description: e.message, variant: "destructive" }),
  });

  const initials = (n: string) =>
    n.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

  const handleSubmit = () => {
    if (!novo.trim() || addMut.isPending) return;
    addMut.mutate(novo.trim());
  };

  if (!itemId) {
    return (
      <div className={cn("rounded-md border border-dashed p-3 text-xs text-muted-foreground flex items-center gap-2", className)}>
        <MessageSquare className="h-3.5 w-3.5" />
        Os comentários ficam disponíveis após salvar.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col rounded-md border bg-muted/20 p-3", className)}>
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Comentários</h4>
      </div>

      <ScrollArea className="pr-3 mb-3 max-h-56">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !comentarios || comentarios.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Nenhum comentário ainda. Inicie a conversa!
          </p>
        ) : (
          <div className="space-y-3">
            {comentarios.map((c) => {
              const own = c.autor_id === user?.id;
              return (
                <div key={c.id} className={cn("flex gap-2", own && "flex-row-reverse")}>
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {c.autor ? initials(c.autor.nome) : "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn("flex-1 max-w-[80%]", own && "text-right")}>
                    <div className="flex items-center gap-2 mb-0.5 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{c.autor?.nome || "Usuário"}</span>
                      <span>{format(parseISO(c.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                      {own && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4"
                          onClick={() => delMut.mutate(c.id)}
                          disabled={delMut.isPending}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-sm inline-block text-left whitespace-pre-wrap break-words",
                        own ? "bg-primary text-primary-foreground" : "bg-background border"
                      )}
                    >
                      <ConteudoComMencoes texto={c.conteudo} membros={membros} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex gap-2">
        <MencaoTextarea
          placeholder="Escreva um comentário..."
          value={novo}
          onChange={setNovo}
          onMencionadosChange={setMencionados}
          onSubmit={handleSubmit}
          className="resize-none min-h-[48px] text-sm"
          rows={2}
        />
        <Button
          type="button"
          onClick={handleSubmit}
          size="icon"
          disabled={!novo.trim() || addMut.isPending}
          className="shrink-0 self-end"
        >
          {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}