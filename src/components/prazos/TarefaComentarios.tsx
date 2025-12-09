import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Comentario {
  id: string;
  prazo_id: string;
  autor_id: string;
  conteudo: string;
  created_at: string;
  autor?: {
    id: string;
    nome: string;
  } | null;
}

interface TarefaComentariosProps {
  prazoId: string;
  className?: string;
}

export function TarefaComentarios({ prazoId, className }: TarefaComentariosProps) {
  const [novoComentario, setNovoComentario] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: comentarios, isLoading } = useQuery({
    queryKey: ["comentarios-prazo", prazoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comentarios_prazos")
        .select(`
          id,
          prazo_id,
          autor_id,
          conteudo,
          created_at
        `)
        .eq("prazo_id", prazoId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Buscar nomes dos autores
      const autorIds = [...new Set(data.map(c => c.autor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", autorIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(c => ({
        ...c,
        autor: profilesMap.get(c.autor_id) || null
      })) as Comentario[];
    },
  });

  const addComentario = useMutation({
    mutationFn: async (conteudo: string) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("comentarios_prazos")
        .insert({
          prazo_id: prazoId,
          autor_id: user.id,
          conteudo,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comentarios-prazo", prazoId] });
      setNovoComentario("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar comentário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteComentario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comentarios_prazos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comentarios-prazo", prazoId] });
      toast({ title: "Comentário excluído" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir comentário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoComentario.trim()) return;
    addComentario.mutate(novoComentario.trim());
  };

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <h4 className="font-medium text-sm mb-3">Comentários e Conversas</h4>
      
      <ScrollArea className="flex-1 pr-4 mb-4 max-h-64">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : comentarios?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum comentário ainda. Inicie a conversa!
          </p>
        ) : (
          <div className="space-y-4">
            {comentarios?.map((comentario) => {
              const isOwn = comentario.autor_id === user?.id;
              return (
                <div
                  key={comentario.id}
                  className={cn(
                    "flex gap-3",
                    isOwn && "flex-row-reverse"
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {comentario.autor ? getInitials(comentario.autor.nome) : "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn("flex-1 max-w-[80%]", isOwn && "text-right")}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {comentario.autor?.nome || "Usuário"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(comentario.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                      {isOwn && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => deleteComentario.mutate(comentario.id)}
                          disabled={deleteComentario.isPending}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm inline-block text-left",
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {comentario.conteudo}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          placeholder="Digite seu comentário..."
          value={novoComentario}
          onChange={(e) => setNovoComentario(e.target.value)}
          className="resize-none min-h-[60px]"
          rows={2}
        />
        <Button 
          type="submit" 
          size="icon"
          disabled={!novoComentario.trim() || addComentario.isPending}
          className="shrink-0 self-end"
        >
          {addComentario.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
