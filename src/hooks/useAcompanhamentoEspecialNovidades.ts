import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEscopoAcompanhamentoEspecial } from "@/hooks/useEscopoAcompanhamentoEspecial";

const LS_KEY = "acomp-especial-novidades-visto-em";

/**
 * Novidades do Acompanhamento Especial no escopo do usuário logado
 * (coordenações que participa ou processos em que é responsável).
 * Conta apenas novos eventos (movimentações) encontrados pela Judit.
 * Divergências de campos NÃO geram aviso.
 */
export function useAcompanhamentoEspecialNovidades() {
  const { processoIds, semRestricao, isLoading: escopoLoading } = useEscopoAcompanhamentoEspecial();
  const [vistoEm, setVistoEm] = useState<string>(() => localStorage.getItem(LS_KEY) || "");

  const { data } = useQuery({
    queryKey: [
      "acomp-especial-novidades",
      semRestricao ? "all" : processoIds.join(","),
      vistoEm,
    ],
    enabled: !escopoLoading,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      if (!semRestricao && processoIds.length === 0) return { eventos: 0 };
      const desde =
        vistoEm || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      let qEventos = supabase
        .from("acompanhamento_especial_eventos")
        .select("id", { count: "exact", head: true })
        .gte("criado_em", desde);
      if (!semRestricao) qEventos = qEventos.in("processo_id", processoIds);
      const ev = await qEventos;
      return { eventos: ev.count ?? 0 };
    },
  });

  const marcarComoVistas = useCallback(() => {
    const agora = new Date().toISOString();
    localStorage.setItem(LS_KEY, agora);
    setVistoEm(agora);
  }, []);

  const eventos = data?.eventos ?? 0;

  return {
    eventos,
    divergencias: 0,
    total: eventos,
    temNovidades: eventos > 0,
    marcarComoVistas,
  };
}
