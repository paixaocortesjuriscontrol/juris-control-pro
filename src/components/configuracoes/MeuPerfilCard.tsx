import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";

/**
 * Card de "Meu Perfil" — permite ao usuário definir a coordenação padrão
 * que será usada como pré-seleção em formulários (tarefas, prazos, publicação DJEN).
 */
export function MeuPerfilCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [coordSelecionada, setCoordSelecionada] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  // Coordenações do usuário (membro OU coordenador)
  const { data: coordenacoes = [], isLoading } = useQuery({
    queryKey: ["meu-perfil-coordenacoes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [membros, coordenador] = await Promise.all([
        supabase
          .from("membros_coordenacao")
          .select("coordenacao_id, coordenacao:coordenacoes(id, nome)")
          .eq("usuario_id", user!.id),
        supabase.from("coordenacoes").select("id, nome").eq("coordenador_id", user!.id),
      ]);
      const map = new Map<string, { id: string; nome: string }>();
      (membros.data || []).forEach((m: any) => {
        if (m.coordenacao) map.set(m.coordenacao.id, m.coordenacao);
      });
      (coordenador.data || []).forEach((c: any) => map.set(c.id, c));
      return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  // Valor atual em profiles.coordenacao_padrao_id
  const { data: profile } = useQuery({
    queryKey: ["meu-perfil", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("coordenacao_padrao_id, nome")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile?.coordenacao_padrao_id) {
      setCoordSelecionada(profile.coordenacao_padrao_id);
    }
  }, [profile?.coordenacao_padrao_id]);

  const salvar = async () => {
    if (!user?.id) return;
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ coordenacao_padrao_id: coordSelecionada || null } as any)
        .eq("id", user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["coordenacao-padrao", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["meu-perfil", user.id] });
      toast.success("Coordenação padrão atualizada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <CardTitle className="text-lg">Meu Perfil</CardTitle>
          <CardDescription>
            Coordenação padrão usada como pré-seleção em novos formulários
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-w-md">
          <Label>Coordenação padrão</Label>
          <Select
            value={coordSelecionada}
            onValueChange={setCoordSelecionada}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? "Carregando…" : "Selecione uma coordenação"} />
            </SelectTrigger>
            <SelectContent>
              {coordenacoes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button onClick={salvar} disabled={salvando || !coordSelecionada}>
            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}