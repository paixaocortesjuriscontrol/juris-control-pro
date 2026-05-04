import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ComentarioRow {
  id: string;
  user_id: string;
  comentario: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  publicacaoId: string;
}

export function ComentariosPublicacaoDjen({ publicacaoId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [novo, setNovo] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoTexto, setEditandoTexto] = useState("");

  const queryKey = ["comentarios-publicacao-djen", publicacaoId];

  const { data: comentarios = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comentarios_publicacoes_djen")
        .select("id, user_id, comentario, created_at, updated_at")
        .eq("publicacao_id", publicacaoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ComentarioRow[];
    },
    enabled: !!publicacaoId,
  });

  const userIds = Array.from(new Set(comentarios.map((c) => c.user_id)));
  const { data: nomes = {} } = useQuery({
    queryKey: ["comentarios-djen-autores", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from("profiles_basic")
        .select("id, nome")
        .in("id", userIds);
      if (error) return {} as Record<string, string>;
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = p.nome || "Usuário";
      });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const criar = useMutation({
    mutationFn: async (texto: string) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase.from("comentarios_publicacoes_djen").insert({
        publicacao_id: publicacaoId,
        user_id: user.id,
        comentario: texto.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setNovo("");
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Comentário adicionado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao comentar"),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, texto }: { id: string; texto: string }) => {
      const { error } = await supabase
        .from("comentarios_publicacoes_djen")
        .update({ comentario: texto.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditandoId(null);
      setEditandoTexto("");
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Comentário atualizado");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comentarios_publicacoes_djen")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Comentário excluído");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center gap-2 mb-2 text-sm font-medium">
        <MessageSquare className="w-4 h-4" />
        Comentários da coordenação
        {comentarios.length > 0 && (
          <span className="text-xs text-muted-foreground">({comentarios.length})</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {comentarios.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum comentário ainda.</p>
          )}
          {comentarios.map((c) => {
            const isAutor = c.user_id === user?.id;
            const isEditando = editandoId === c.id;
            return (
              <div key={c.id} className="rounded-md border bg-muted/30 p-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-foreground">
                    {nomes[c.user_id] || "Usuário"}
                    <span className="ml-2 text-muted-foreground font-normal">
                      {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {c.updated_at !== c.created_at && " (editado)"}
                    </span>
                  </div>
                  {isAutor && !isEditando && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditandoId(c.id);
                          setEditandoTexto(c.comentario);
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => {
                          if (confirm("Excluir este comentário?")) excluir.mutate(c.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {isEditando ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editandoTexto}
                      onChange={(e) => setEditandoTexto(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          atualizar.mutate({ id: c.id, texto: editandoTexto })
                        }
                        disabled={!editandoTexto.trim() || atualizar.isPending}
                      >
                        <Check className="w-3 h-3 mr-1" /> Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditandoId(null);
                          setEditandoTexto("");
                        }}
                      >
                        <X className="w-3 h-3 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-foreground">{c.comentario}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Escreva um comentário visível para sua coordenação..."
          rows={2}
          className="text-xs"
        />
        <Button
          size="sm"
          onClick={() => criar.mutate(novo)}
          disabled={!novo.trim() || criar.isPending}
        >
          {criar.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
          Comentar
        </Button>
      </div>
    </div>
  );
}