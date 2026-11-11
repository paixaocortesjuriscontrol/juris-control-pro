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
  /** Delegação: perfis/cargos com "coordenador" no nome veem todas as coordenações. */
  delegacao?: boolean;
  /** Pré-seleciona a coordenação do usuário quando vazio (desligar na edição). */
  autoSelect?: boolean;
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
  delegacao,
  autoSelect = true,
}: CoordenacaoSelectProps) {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["coordenacao-select", user?.id, !!delegacao],
    queryFn: async () => {
      const userId = user?.id ?? "";
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isAdmin = roleData?.some((r: any) => r.role === "admin" || r.role === "assistente_juridico_geral") ?? false;

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

      if (delegacao) {
        let podeTodas = (roleData || []).some((r: any) => /coordenador/i.test(String(r.role)));
        if (!podeTodas) {
          const { data: cargos } = await (supabase as any)
            .from("membros_coordenacao").select("cargo").eq("usuario_id", userId);
          podeTodas = (cargos || []).some((c: any) => /coordenador/i.test(String(c.cargo || "")));
        }
        if (podeTodas) {
          const { data: all } = await supabase.from("coordenacoes").select("id, nome").order("nome");
          const lista = all ?? [];
          const proprias = lista.filter((c: any) => allIds.includes(c.id));
          const outras = lista.filter((c: any) => !allIds.includes(c.id));
          return { coordenacoes: [...proprias, ...outras], defaultId: proprias[0]?.id ?? null };
        }
      }
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

  const listaBase = data?.coordenacoes ?? [];
  const defaultId = data?.defaultId ?? null;
  const faltaNaLista = !!value && !!data && !listaBase.some((c: any) => c.id === value);

  // Coordenação gravada fora da lista do usuário: busca o nome só para exibir.
  const { data: extra } = useQuery({
    queryKey: ["coordenacao-select-extra", value],
    queryFn: async () => {
      const { data: c } = await supabase.from("coordenacoes").select("id, nome").eq("id", value as string).maybeSingle();
      return c;
    },
    enabled: faltaNaLista,
    staleTime: 5 * 60 * 1000,
  });
  const coordenacoes = faltaNaLista && extra ? [extra, ...listaBase] : listaBase;

  // Pré-selecionar coordenação do usuário quando vazio (reage também a limpezas
  // feitas pelo formulário durante o carregamento).
  useEffect(() => {
    if (autoSelect && !value && defaultId) {
      onChange(defaultId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, defaultId, autoSelect]);

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