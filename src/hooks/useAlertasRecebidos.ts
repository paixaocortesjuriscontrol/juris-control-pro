import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AlertaRecebido {
  id: string;
  tipo_alerta: string;
  canal: string;
  destinatario: string;
  conteudo: string | null;
  enviado_em: string;
  status: string | null;
}

const LS_KEY = "alertas-recebidos-visto-em";

function onlyDigits(v?: string | null) {
  return (v || "").replace(/\D/g, "");
}

/**
 * Alertas efetivamente enviados ao usuário logado por WhatsApp ou e-mail.
 * Usados para compor o contador do sino.
 */
export function useAlertasRecebidos() {
  const { user } = useAuth();
  const [vistoEm, setVistoEm] = useState<string>(() => localStorage.getItem(LS_KEY) || "");

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

  const { data: alertas = [] } = useQuery({
    queryKey: ["alertas-recebidos", email, telefone],
    enabled: !!email || !!telefone,
    staleTime: 60_000,
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 30);
      const { data, error } = await supabase
        .from("historico_alertas_enviados")
        .select("id, tipo_alerta, canal, destinatario, conteudo, enviado_em, status")
        .gte("enviado_em", desde.toISOString())
        .order("enviado_em", { ascending: false })
        .limit(200);
      if (error) return [] as AlertaRecebido[];
      return ((data || []) as AlertaRecebido[]).filter((a) => {
        const d = (a.destinatario || "").toLowerCase();
        if (email && d === email) return true;
        if (telefone && onlyDigits(d).endsWith(telefone.slice(-8))) return true;
        return false;
      });
    },
  });

  const naoVistos = vistoEm ? alertas.filter((a) => a.enviado_em > vistoEm) : alertas;

  const marcarComoVistos = useCallback(() => {
    const agora = new Date().toISOString();
    localStorage.setItem(LS_KEY, agora);
    setVistoEm(agora);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("alertas-recebidos-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "historico_alertas_enviados" }, () => {
        // apenas invalida via refetch natural do staleTime
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { alertas, naoVistos, totalNaoVistos: naoVistos.length, marcarComoVistos };
}
