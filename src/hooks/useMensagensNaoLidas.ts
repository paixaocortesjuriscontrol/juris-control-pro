import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function onlyDigits(v?: string | null) {
  return (v || "").replace(/\D/g, "");
}

/**
 * Total de mensagens recebidas (e-mail/WhatsApp) ainda não lidas pelo usuário logado.
 * Mesma regra usada na lista "Mensagens recebidas" (últimos 30 dias, escopo pessoal).
 */
export function useMensagensNaoLidas() {
  const { user } = useAuth();

  const { data: perfil } = useQuery({
    queryKey: ["perfil-contatos", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email, telefone")
        .eq("id", user!.id)
        .maybeSingle();
      return data as { email: string | null; telefone: string | null } | null;
    },
  });

  const email = (perfil?.email || user?.email || "").toLowerCase();
  const telefone = onlyDigits(perfil?.telefone);

  const { data: total = 0 } = useQuery({
    queryKey: ["mensagens-nao-lidas", user?.id, email, telefone],
    enabled: !!user?.id && (!!email || !!telefone),
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 30);

      const { data: msgs } = await supabase
        .from("historico_alertas_enviados")
        .select("id, destinatario")
        .gte("enviado_em", desde.toISOString())
        .order("enviado_em", { ascending: false })
        .limit(500);

      const meus = ((msgs || []) as { id: string; destinatario: string | null }[])
        .filter((m) => {
          const dest = (m.destinatario || "").toLowerCase();
          return (
            (!!email && dest === email) ||
            (!!telefone && onlyDigits(dest).endsWith(telefone.slice(-8)))
          );
        })
        .map((m) => m.id);
      if (meus.length === 0) return 0;

      // Buscamos as leituras APENAS destas mensagens: quem já leu milhares de
      // alertas estourava o limite de 1000 linhas por consulta e as mensagens
      // voltavam a aparecer como não lidas.
      const lidos = new Set<string>();
      const CHUNK = 150;
      for (let i = 0; i < meus.length; i += CHUNK) {
        const { data } = await supabase
          .from("alertas_recebidos_leituras")
          .select("alerta_id")
          .eq("user_id", user!.id)
          .in("alerta_id", meus.slice(i, i + CHUNK));
        for (const l of (data || []) as { alerta_id: string }[]) lidos.add(l.alerta_id);
      }
      return meus.filter((id) => !lidos.has(id)).length;

    },
  });

  return { totalNaoLidas: total };
}
