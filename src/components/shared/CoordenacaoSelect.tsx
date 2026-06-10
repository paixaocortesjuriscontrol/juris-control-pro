import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CoordenacaoSelectProps {
  value: string | null | undefined;
  onChange: (id: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

/**
 * Select de coordenação reutilizável.
 * - Admin: lista todas as coordenações.
 * - Demais usuários: lista as coordenações em que é membro ou coordenador.
 * - Pré-seleciona automaticamente a coordenação do usuário logado quando `value`
 *   está vazio.
 */
export function CoordenacaoSelect({
  value,
  onChange,
  label = "Coordenação",
  required,
  className,
}: CoordenacaoSelectProps) {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["coordenacao-select", user?.id],
    queryFn: async () => {
      const userId = user?.id ?? "";
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isAdmin = roleData?.some((r: any) => r.role === "admin") ?? false;

      if (isAdmin) {
        const { data: all } = await supabase
          .from("coordenacoes")
          .select("id, nome")
          .order("nome");
        return { coordenacoes: all ?? [], defaultId: null as string | null };
      }

      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", userId);
      const ids = membros?.map((m: any) => m.coordenacao_id) ?? [];

      const { data: coordenadas } = await supabase
        .from("coordenacoes")
        .select("id")
        .eq("coordenador_id", userId);
      const coordIds = coordenadas?.map((c: any) => c.id) ?? [];

      const allIds = [...new Set([...ids, ...coordIds])];
      if (allIds.length === 0) return { coordenacoes: [], defaultId: null };

      const { data: coords } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .in("id", allIds)
        .order("nome");
      return { coordenacoes: coords ?? [], defaultId: coords?.[0]?.id ?? null };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const coordenacoes = data?.coordenacoes ?? [];
  const defaultId = data?.defaultId ?? null;

  // Pré-selecionar coordenação do usuário quando vazio
  useEffect(() => {
    if (!value && defaultId) {
      onChange(defaultId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultId]);

  return (
    <div className={className}>
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger className="h-10 mt-1.5">
          <SelectValue placeholder="Selecione a coordenação" />
        </SelectTrigger>
        <SelectContent>
          {coordenacoes.map((c: any) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}