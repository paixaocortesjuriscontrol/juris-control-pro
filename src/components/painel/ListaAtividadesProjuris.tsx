import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Search } from "lucide-react";
import { parseISO, isValid, format, startOfDay } from "date-fns";
import type { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";
import { isItemConcluidoComSucesso, isItemRiscado } from "@/components/shared/TratadoCheck";
import { cn } from "@/lib/utils";

interface Props {
  itens: ItemAgendaUnificado[];
  onItemClick: (item: ItemAgendaUnificado) => void;
}

const fmt = (raw?: string | null) => {
  if (!raw) return null;
  const d = parseISO(raw);
  return isValid(d) ? d : null;
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluída",
  concluida: "Concluída",
  cancelado: "Cancelada",
  cancelada: "Cancelada",
  protocolado: "Protocolada",
  baixado: "Baixada",
  tratado: "Tratada",
};

const iniciais = (nome?: string | null) =>
  (nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

function Campo({ rotulo, valor, alerta }: { rotulo: string; valor?: string | null; alerta?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{rotulo}</div>
      <div className="text-sm font-medium truncate flex items-center gap-1" title={valor || "Não informado"}>
        <span className="truncate">{valor || "Não informado"}</span>
        {alerta && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
      </div>
    </div>
  );
}

export function ListaAtividadesProjuris({ itens, onItemClick }: Props) {
  const [busca, setBusca] = useState("");
  const hoje = startOfDay(new Date());

  const clienteIds = useMemo(
    () => Array.from(new Set(itens.map((i) => i.processo?.cliente_id).filter(Boolean) as string[])).sort(),
    [itens],
  );
  const { data: clientes } = useQuery({
    queryKey: ["atividades-clientes-nomes", clienteIds],
    enabled: clienteIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map = new Map<string, string>();
      for (let i = 0; i < clienteIds.length; i += 200) {
        const { data, error } = await supabase.from("clientes").select("id, nome").in("id", clienteIds.slice(i, i + 200));
        if (error) throw error;
        (data ?? []).forEach((c: any) => map.set(c.id, c.nome));
      }
      return map;
    },
  });

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const base = [...itens].sort((a, b) => {
      const da = a.data_prevista ?? a.data_vencimento ?? a.data_inicio ?? "";
      const db = b.data_prevista ?? b.data_vencimento ?? b.data_inicio ?? "";
      return da.localeCompare(db);
    });
    if (!t) return base;
    return base.filter((i) =>
      [i.titulo, i.tipo_tarefa, i.descricao, i.processo?.numero, i.responsavel?.nome]
        .some((v) => (v || "").toLowerCase().includes(t)),
    );
  }, [itens, busca]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Lista de atividades</h2>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{lista.length} atividade(s)</div>
      <div className="border rounded-md divide-y bg-card">
        {lista.map((item) => {
          const prevista = fmt(item.data_prevista ?? item.data_vencimento ?? item.data_inicio);
          const fatal = fmt(item.data_fatal ?? item.data_vencimento ?? item.data_inicio);
          const fechado = isItemRiscado(item) || isItemConcluidoComSucesso(item);
          const sucesso = isItemConcluidoComSucesso(item);
          const atrasoP = !fechado && prevista && prevista < hoje;
          const atrasoF = !fechado && fatal && fatal < hoje;
          const cliente = item.processo?.cliente_id ? clientes?.get(item.processo.cliente_id) : null;
          const resp = item.responsavel?.nome ?? item.participantes?.[0]?.usuario?.nome ?? item.criador?.nome;
          const temTipo = !!item.tipo_tarefa;
          const statusTxt = sucesso ? "Concluída com sucesso" : STATUS_LABEL[item.status] ?? item.status;
          return (
            <button
              key={`${item.origem}-${item.id}-${item.data_inicio}`}
              type="button"
              onClick={() => onItemClick(item)}
              className="w-full text-left grid grid-cols-[1fr_1.4fr_1.6fr_auto_auto] gap-4 items-center px-4 py-2 border-l-4 border-l-primary hover:bg-muted/50"
            >
              <div className="space-y-1">
                <Campo rotulo="Prevista" valor={prevista ? format(prevista, "dd/MM/yyyy") : null} alerta={!!atrasoP} />
                <Campo rotulo="Fatal" valor={fatal ? format(fatal, "dd/MM/yyyy") : null} alerta={!!atrasoF} />
              </div>
              <div className="space-y-1">
                <Campo rotulo="Vínculo" valor={item.processo?.numero} />
                <Campo rotulo="Cliente" valor={cliente} />
              </div>
              <div className="space-y-1">
                <Campo rotulo={temTipo ? "Tipo de tarefa" : "Título"} valor={temTipo ? item.tipo_tarefa : item.titulo} />
                <Campo rotulo="Descrição" valor={temTipo ? item.titulo || item.descricao : item.descricao} />
              </div>
              <Badge variant={sucesso ? "default" : "secondary"} className={cn("whitespace-nowrap", sucesso && "bg-emerald-700 text-primary-foreground hover:bg-emerald-700")}>
                {statusTxt}
              </Badge>
              <div
                className="h-9 w-9 rounded-md bg-accent text-accent-foreground flex items-center justify-center text-xs font-semibold"
                title={resp || ""}
              >
                {iniciais(resp)}
              </div>
            </button>
          );
        })}
        {lista.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma atividade.</div>}
      </div>
    </div>
  );
}
