import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, MessageCircle, Check, Inbox, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  referencia_id?: string | null;
  itens_referencias?: { id: string; titulo?: string | null; origem?: string | null }[] | null;
}

function onlyDigits(v?: string | null) {
  return (v || "").replace(/\D/g, "");
}

export default function MinhasMensagensRecebidas({
  periodoInicio,
  periodoFim,
  coordenacaoId,
  todosDestinatarios = false,
  onAbrirItem,
}: {
  periodoInicio?: Date;
  periodoFim?: Date;
  /** "todas" ou id da coordenação */
  coordenacaoId?: string;
  /** quando true (modo Escritório para admin/coordenador), mostra mensagens de todos */
  todosDestinatarios?: boolean;
  /** abre o item (tarefa/prazo/evento/audiência) vinculado ao alerta */
  onAbrirItem?: (referenciaId: string) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroLeitura, setFiltroLeitura] = useState<"todas" | "nao_lidas" | "lidas">("todas");

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
        .select("id, tipo_alerta, canal, destinatario, conteudo, enviado_em, status, referencia_id, itens_referencias")
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

  // Nomes dos destinatários (por e-mail / telefone)
  const { data: pessoas = [] } = useQuery({
    queryKey: ["perfis-destinatarios-alertas"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("nome, email, telefone");
      return (data || []) as { nome: string | null; email: string | null; telefone: string | null }[];
    },
  });

  const nomePorContato = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pessoas) {
      if (!p.nome) continue;
      if (p.email) map.set(p.email.toLowerCase(), p.nome);
      const tel = onlyDigits(p.telefone);
      if (tel.length >= 8) map.set(tel.slice(-8), p.nome);
    }
    return map;
  }, [pessoas]);

  const nomeDestinatario = (dest?: string | null) => {
    const d = (dest || "").trim();
    if (!d) return "";
    const porEmail = nomePorContato.get(d.toLowerCase());
    if (porEmail) return porEmail;
    const dig = onlyDigits(d);
    if (dig.length >= 8) {
      const porTel = nomePorContato.get(dig.slice(-8));
      if (porTel) return porTel;
    }
    return d;
  };

  /** Remove códigos técnicos de deduplicação, ex.: [4ecf871c|2026-07-24|d2] */
  const limparConteudo = (texto?: string | null) =>
    (texto || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\[[0-9a-f]{6,8}\|[^\]]*\]/gi, "")
      .trim();

  const listaBruta = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return mensagens.filter((m) => {
      if (filtroLeitura === "nao_lidas" && lidos.has(m.id)) return false;
      if (filtroLeitura === "lidas" && !lidos.has(m.id)) return false;
      if (!termo) return true;
      return (
        (m.conteudo || "").toLowerCase().includes(termo) ||
        (m.tipo_alerta || "").toLowerCase().includes(termo)
      );
    });
  }, [mensagens, busca, filtroLeitura, lidos]);

  /**
   * Agrupa mensagens idênticas (mesmo destinatário, mesmo minuto de envio e mesmo
   * conteúdo) enviadas por canais diferentes (WhatsApp + e-mail) em um único card.
   */
  const lista = useMemo(() => {
    const grupos = new Map<string, Mensagem & { ids: string[]; canais: string[]; pessoas: string[] }>();
    for (const m of listaBruta) {
      const pessoa = nomeDestinatario(m.destinatario) || m.destinatario || "";
      const minuto = new Date(m.enviado_em).toISOString().slice(0, 16);
      const chave = `${minuto}|${m.tipo_alerta || ""}|${limparConteudo(m.conteudo)}`;
      const existente = grupos.get(chave);
      if (existente) {
        existente.ids.push(m.id);
        if (pessoa && !existente.pessoas.includes(pessoa)) existente.pessoas.push(pessoa);
        if (!existente.canais.includes((m.canal || "").toLowerCase())) {
          existente.canais.push((m.canal || "").toLowerCase());
        }
        if (!existente.referencia_id && m.referencia_id) existente.referencia_id = m.referencia_id;
        if (
          (!existente.itens_referencias || existente.itens_referencias.length === 0) &&
          m.itens_referencias
        ) {
          existente.itens_referencias = m.itens_referencias;
        }
      } else {
        grupos.set(chave, {
          ...m,
          ids: [m.id],
          canais: [(m.canal || "").toLowerCase()],
          pessoas: pessoa ? [pessoa] : [],
        });
      }
    }
    return Array.from(grupos.values());
  }, [listaBruta, nomePorContato]);

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
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["minhas-mensagens-leituras", user.id], refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: ["mensagens-nao-lidas"], refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: ["alertas-recebidos"], refetchType: "all" }),
    ]);
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
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={filtroLeitura === "todas" ? "default" : "outline"}
              onClick={() => setFiltroLeitura("todas")}
            >
              Todas
            </Button>
            <Button
              size="sm"
              variant={filtroLeitura === "nao_lidas" ? "default" : "outline"}
              onClick={() => setFiltroLeitura("nao_lidas")}
            >
              Não lidas
            </Button>
            <Button
              size="sm"
              variant={filtroLeitura === "lidas" ? "default" : "outline"}
              onClick={() => setFiltroLeitura("lidas")}
            >
              Lidas
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={naoLidas === 0}
            onClick={() =>
              marcarLida(
                mensagens
                  .flatMap((m) => m.ids)
                  .filter((id) => !lidos.has(id)),
              )
            }
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
          {lista.map((m) => {
            const lida = m.ids.every((id) => lidos.has(id));
            const temWhats = m.canais.some((c) => c.includes("whats"));
            const temEmail = m.canais.some((c) => !c.includes("whats"));
            const refs = Array.isArray(m.itens_referencias) ? m.itens_referencias.filter((r) => r?.id) : [];
            const refUnico = m.referencia_id || (refs.length === 1 ? refs[0].id : null);
            const podeAbrir = !!refUnico && !!onAbrirItem;
            const temLista = !refUnico && refs.length > 1 && !!onAbrirItem;
            return (
              <Card
                key={m.id}
                className={cn(
                  "p-4 flex gap-3 items-start transition-colors",
                  !lida && "border-primary/50 bg-primary/5",
                  podeAbrir && "cursor-pointer hover:shadow-md hover:border-primary"
                )}
                onClick={() => {
                  if (!podeAbrir) return;
                  onAbrirItem!(refUnico!);
                  if (!lida) marcarLida(m.ids);
                }}
              >
                <div className="mt-0.5 flex flex-col gap-1">
                  {temWhats && <MessageCircle className="h-4 w-4 text-emerald-600" />}
                  {temEmail && <Mail className="h-4 w-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {m.tipo_alerta || "alerta"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(m.enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                    <span className="text-xs text-muted-foreground line-clamp-2" title={m.pessoas.join(", ")}>
                      {m.pessoas.length > 1
                        ? `${m.pessoas.length} destinatários: ${m.pessoas.join(", ")}`
                        : m.pessoas[0] || nomeDestinatario(m.destinatario)}
                    </span>
                    {!lida && <Badge variant="destructive" className="text-[10px]">Nova</Badge>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {limparConteudo(m.conteudo) || "(sem conteúdo)"}
                  </p>
                  {temLista && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Abrir item ({refs.length})
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-72 overflow-auto z-50 bg-popover">
                        {refs.map((r) => (
                          <DropdownMenuItem
                            key={r.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAbrirItem!(r.id);
                              if (!lida) marcarLida(m.ids);
                            }}
                          >
                            <span className="truncate max-w-[260px]">{r.titulo || r.id}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {!lida && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      marcarLida(m.ids);
                    }}
                  >
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