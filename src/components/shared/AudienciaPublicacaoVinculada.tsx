import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicacaoVinculadaCollapsible } from "@/components/shared/PublicacaoVinculadaCollapsible";

interface Props {
  audienciaId?: string | null;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * Exibe a publicação DJEN vinculada a uma audiência (termo, processo ou descartada),
 * usando o mesmo visual do Painel de Controle. Nada é renderizado sem vínculo.
 */
export function AudienciaPublicacaoVinculada({ audienciaId, className, defaultOpen = false }: Props) {
  const { data: publicacao } = useQuery({
    queryKey: ["audiencia-publicacao-vinculada", audienciaId],
    enabled: !!audienciaId,
    staleTime: 60_000,
    queryFn: async () => {
      const cols =
        "id, processo_numero, data_publicacao, data_disponibilizacao, tribunal, tipo_comunicacao, conteudo, polo_ativo, polo_passivo";

      const { data: vTermo } = await (supabase as any)
        .from("audiencias_publicacoes")
        .select("publicacao_id")
        .eq("audiencia_id", audienciaId)
        .maybeSingle();
      if (vTermo?.publicacao_id) {
        const { data: pub } = await (supabase as any)
          .from("publicacoes_djen")
          .select(cols)
          .eq("id", vTermo.publicacao_id)
          .maybeSingle();
        if (pub) return pub;
      }

      const { data: vProc } = await (supabase as any)
        .from("audiencias_publicacoes_processos")
        .select("publicacao_processo_id")
        .eq("audiencia_id", audienciaId)
        .maybeSingle();
      if (vProc?.publicacao_processo_id) {
        const { data: pub } = await (supabase as any)
          .from("publicacoes_djen_processos")
          .select(cols)
          .eq("id", vProc.publicacao_processo_id)
          .maybeSingle();
        if (pub) return pub;
      }

      const { data: vDesc } = await (supabase as any)
        .from("audiencias_publicacoes_descartadas")
        .select("publicacao_descartada_id")
        .eq("audiencia_id", audienciaId)
        .maybeSingle();
      if (vDesc?.publicacao_descartada_id) {
        const { data: pub } = await (supabase as any)
          .from("publicacoes_djen_descartadas")
          .select(cols)
          .eq("id", vDesc.publicacao_descartada_id)
          .maybeSingle();
        if (pub) return pub;
      }

      return null;
    },
  });

  if (!publicacao) return null;
  return (
    <PublicacaoVinculadaCollapsible
      publicacao={publicacao as any}
      className={className}
      defaultOpen={defaultOpen}
    />
  );
}