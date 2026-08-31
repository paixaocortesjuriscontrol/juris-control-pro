import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, MapPin, Repeat, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const SITUACAO_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_execucao: "Em execução",
  a_confirmar: "A confirmar",
  revisao: "Em revisão",
  verificado: "Verificado",
  cumprido: "Cumprido",
  concluido: "Concluído",
  concluido_sem_sucesso: "Concluído sem sucesso",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

const RECORRENCIA_LABELS: Record<string, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  anual: "Anual",
};

/** Busca responsáveis e participantes de todos os eventos de uma vez. */
export function useEventosPessoas(eventoIds: string[]) {
  const chave = [...eventoIds].sort().join(",");
  return useQuery({
    queryKey: ["eventos-pessoas", chave],
    enabled: eventoIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const [resp, part] = await Promise.all([
        supabase.from("evento_responsaveis").select("evento_id, usuario_id").in("evento_id", eventoIds),
        supabase.from("participantes_evento").select("evento_id, usuario_id").in("evento_id", eventoIds),
      ]);
      const linhas = [
        ...((resp.data as any[]) || []).map((r) => ({ ...r, papel: "responsavel" })),
        ...((part.data as any[]) || []).map((r) => ({ ...r, papel: "participante" })),
      ];
      const userIds = [...new Set(linhas.map((l) => l.usuario_id).filter(Boolean))];
      let nomes: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);
        nomes = Object.fromEntries(((profs as any[]) || []).map((p) => [p.id, p.nome]));
      }
      const mapa: Record<string, { responsaveis: string[]; participantes: string[] }> = {};
      for (const l of linhas) {
        const nome = nomes[l.usuario_id];
        if (!nome) continue;
        mapa[l.evento_id] ||= { responsaveis: [], participantes: [] };
        const alvo = l.papel === "responsavel" ? mapa[l.evento_id].responsaveis : mapa[l.evento_id].participantes;
        if (!alvo.includes(nome)) alvo.push(nome);
      }
      return mapa;
    },
  });
}

const parseData = (valor?: string | null) => {
  if (!valor) return null;
  try {
    const d = valor.includes("T") ? parseISO(valor) : new Date(`${valor}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const horaDe = (valor?: string | null) => {
  const d = parseData(valor);
  if (!d) return null;
  const hhmm = format(d, "HH:mm");
  return hhmm === "00:00" ? null : hhmm;
};

interface Props {
  evento: any;
  pessoas?: { responsaveis: string[]; participantes: string[] };
  onClick: () => void;
}

export function EventoProcessoCard({ evento, pessoas, onClick }: Props) {
  const inicio = parseData(evento.data_inicio);
  const fim = parseData(evento.data_fim);
  const horaInicio = evento.dia_inteiro ? null : horaDe(evento.data_inicio);
  const horaFim = evento.dia_inteiro ? null : horaDe(evento.data_fim);
  const situacao = (evento.status || "pendente").toLowerCase();
  const concluido = ["concluido", "cumprido", "verificado"].includes(situacao);
  const atrasado = !!inicio && inicio < new Date() && !concluido;

  const linhaData = [
    inicio ? format(inicio, "dd/MM/yyyy", { locale: ptBR }) : "Sem data",
    inicio ? format(inicio, "EEEE", { locale: ptBR }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug break-words">{evento.titulo || "Sem título"}</p>
          <div className="flex items-center gap-1 shrink-0">
            {atrasado && (
              <Badge variant="destructive" className="text-[10px]">
                Atrasado
              </Badge>
            )}
            <Badge variant={concluido ? "default" : "secondary"} className="text-[10px] whitespace-nowrap">
              {SITUACAO_LABELS[situacao] || evento.status || "Pendente"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 capitalize">
            <Calendar className="w-3 h-3" />
            {linhaData}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {evento.dia_inteiro
              ? "Dia inteiro"
              : [horaInicio, horaFim].filter(Boolean).join(" às ") || "Sem horário"}
          </span>
          {fim && inicio && format(fim, "yyyy-MM-dd") !== format(inicio, "yyyy-MM-dd") && (
            <span>Término: {format(fim, "dd/MM/yyyy", { locale: ptBR })}</span>
          )}
          {evento.recorrente && (
            <span className="flex items-center gap-1">
              <Repeat className="w-3 h-3" />
              {RECORRENCIA_LABELS[String(evento.recorrencia_tipo || "").toLowerCase()] || "Recorrente"}
              {evento.recorrencia_fim
                ? ` até ${format(parseData(evento.recorrencia_fim)!, "dd/MM/yyyy", { locale: ptBR })}`
                : ""}
            </span>
          )}
          {evento.local && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {evento.local}
            </span>
          )}
          {evento.modalidade && <span className="capitalize">{evento.modalidade}</span>}
        </div>

        {(pessoas?.responsaveis?.length || pessoas?.participantes?.length) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {!!pessoas?.responsaveis?.length && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                Responsável: {pessoas.responsaveis.join(", ")}
              </span>
            )}
            {!!pessoas?.participantes?.length && (
              <span>Participantes: {pessoas.participantes.join(", ")}</span>
            )}
          </div>
        )}

        {evento.descricao && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words line-clamp-3">
            {evento.descricao}
          </p>
        )}

        <p className="text-[10px] text-muted-foreground">
          {evento.origem ? `Origem: ${evento.origem} · ` : ""}
          Criado em{" "}
          {evento.created_at ? format(parseISO(evento.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
        </p>
      </CardContent>
    </Card>
  );
}
