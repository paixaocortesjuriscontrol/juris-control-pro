import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, MessageCircle, Check, Inbox } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Mensagem {
  id: string;
  tipo_alerta: string;
  canal: string;
  destinatario: string;
  conteudo: string | null;
  enviado_em: string;
  status: string | null;
}

function onlyDigits(v?: string | null) {
  return (v || "").replace(/\D/g, "");
}

export default function MinhasMensagensRecebidas({
  periodoInicio,
  periodoFim,
  coordenacaoId,
  todosDestinatarios = false,
}: {
  periodoInicio?: Date;
  periodoFim?: Date;
  /** "todas" ou id da coordenação */
  coordenacaoId?: string;
  /** quando true (modo Escritório para admin/coordenador), mostra mensagens de todos */
  todosDestinatarios?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false);

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

  const inicioISO = periodoInicio
    ? new Date(new Date(periodoInicio).setHours(0, 0, 0, 0)).toISOString()
    : undefined;
  const fimISO = periodoFim
    ? new Date(new Date(periodoFim).setHours(23, 59, 59, 999)).toISOString()
    : undefined;
  const coordFiltro = coordenacaoId && coordenacaoId !== "todas" ? coordenacaoId : undefined;

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ["minhas-mensagens", email, telefone, inicioISO, fimISO, coordFiltro, todosDestinatarios],
    enabled: todosDestinatarios || !!email || !!telefone,
    queryFn: async () => {
      let q = supabase
        .from("historico_alertas_enviados")
        .select("id, tipo_alerta, canal, destinatario, conteudo, enviado_em, status")
        .order("enviado_em", { ascending: false })
        .limit(500);
      if (inicioISO) q = q.gte("enviado_em", inicioISO);
      if (fimISO) q = q.lte("enviado_em", fimISO);
      if (coordFiltro) q = q.eq("coordenacao_id", coordFiltro);
      if (!inicioISO && !fimISO) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        q = q.gte("enviado_em", d.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as Mensagem[];
      if (todosDestinatarios) return rows;
      return rows.filter((m) => {
        const dest = (m.destinatario || "").toLowerCase();
        if (email && dest === email) return true;
        if (telefone && onlyDigits(dest).endsWith(telefone.slice(-8))) return true;
        return false;
      });
    },
  });

  const { data: leituras = [] } = useQuery({
    queryKey: ["minhas-mensagens-leituras", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_recebidos_leituras")
        .select("alerta_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((l: { alerta_id: string }) => l.alerta_id);
    },
  });

  const lidos = useMemo(() => new Set(leituras), [leituras]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return mensagens.filter((m) => {
      if (apenasNaoLidas && lidos.has(m.id)) return false;
      if (!termo) return true;
      return (
        (m.conteudo || "").toLowerCase().includes(termo) ||
        (m.tipo_alerta || "").toLowerCase().includes(termo)
      );
    });
  }, [mensagens, busca, apenasNaoLidas, lidos]);

  const naoLidas = mensagens.filter((m) => !lidos.has(m.id)).length;

  const marcarLida = async (ids: string[]) => {
    if (!user?.id || ids.length === 0) return;
    const { error } = await supabase
      .from("alertas_recebidos_leituras")
      .upsert(
        ids.map((alerta_id) => ({ user_id: user.id, alerta_id })),
        { onConflict: "user_id,alerta_id" }
      );
    if (error) {
      toast.error("Não foi possível marcar como lida");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["minhas-mensagens-leituras", user.id] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          Mensagens recebidas
          <Badge variant="secondary">{mensagens.length}</Badge>
          {naoLidas > 0 && <Badge variant="destructive">{naoLidas} não lidas</Badge>}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na mensagem..."
            className="h-9 w-56"
          />
          <Button
            size="sm"
            variant={apenasNaoLidas ? "default" : "outline"}
            onClick={() => setApenasNaoLidas((v) => !v)}
          >
            Só não lidas
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={naoLidas === 0}
            onClick={() => marcarLida(mensagens.filter((m) => !lidos.has(m.id)).map((m) => m.id))}
          >
            <Check className="h-4 w-4 mr-1" /> Marcar todas
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
      ) : lista.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma mensagem recebida no período.
        </Card>
      ) : (
        <div className="space-y-2">
          {lista.map((m) => {
            const lida = lidos.has(m.id);
            const isWhats = (m.canal || "").toLowerCase().includes("whats");
            return (
              <Card
                key={m.id}
                className={cn(
                  "p-4 flex gap-3 items-start transition-colors",
                  !lida && "border-primary/50 bg-primary/5"
                )}
              >
                <div className="mt-0.5">
                  {isWhats ? (
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Mail className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {m.tipo_alerta || "alerta"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(m.enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{m.destinatario}</span>
                    {!lida && <Badge variant="destructive" className="text-[10px]">Nova</Badge>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {(m.conteudo || "").replace(/<[^>]+>/g, " ").trim() || "(sem conteúdo)"}
                  </p>
                </div>
                {!lida && (
                  <Button size="sm" variant="ghost" onClick={() => marcarLida([m.id])}>
                    <Check className="h-4 w-4 mr-1" /> Lida
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}