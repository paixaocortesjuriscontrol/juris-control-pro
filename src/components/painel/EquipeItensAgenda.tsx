import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";
import { isItemTratado } from "@/components/shared/TratadoCheck";
import { Users, Search, CheckCircle2, Clock, XCircle, ListTodo } from "lucide-react";
import { format, parseISO, isValid, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EquipeItensAgendaProps {
  itens: ItemAgendaUnificado[];
  onItemClick: (item: ItemAgendaUnificado) => void;
}

interface MembroStats {
  id: string;
  nome: string;
  total: number;
  pendentes: number;
  atrasadas: number;
  cumpridas: number;
  itens: ItemAgendaUnificado[];
}

function getRefDate(item: ItemAgendaUnificado): Date | null {
  const raw = item.data_fatal ?? item.data_vencimento ?? item.data_inicio;
  if (!raw) return null;
  const d = parseISO(raw);
  return isValid(d) ? d : null;
}

function getPessoas(item: ItemAgendaUnificado): { id: string; nome: string }[] {
  const map = new Map<string, string>();
  if (item.responsavel?.id) map.set(item.responsavel.id, item.responsavel.nome);
  (item.participantes || []).forEach((p) => {
    if (p.usuario_id) map.set(p.usuario_id, p.usuario?.nome || "Sem nome");
  });
  return Array.from(map, ([id, nome]) => ({ id, nome }));
}

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

export function EquipeItensAgenda({ itens, onItemClick }: EquipeItensAgendaProps) {
  const [selectedMembro, setSelectedMembro] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const processoIds = useMemo(
    () => Array.from(new Set(itens.map((i) => i.processo_id).filter(Boolean))) as string[],
    [itens]
  );

  const { data: processoInfo = {} } = useQuery({
    queryKey: ["equipe-processos-info", processoIds.length, processoIds.slice(0, 50).join(",")],
    enabled: processoIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map: Record<string, { polo_ativo?: string | null; cliente?: string | null }> = {};
      for (let i = 0; i < processoIds.length; i += 200) {
        const chunk = processoIds.slice(i, i + 200);
        const { data, error } = await supabase
          .from("processos")
          .select("id, polo_ativo, cliente:clientes!processos_cliente_id_fkey(nome)")
          .in("id", chunk);
        if (error) throw error;
        (data || []).forEach((p: any) => {
          map[p.id] = { polo_ativo: p.polo_ativo, cliente: p.cliente?.nome ?? null };
        });
      }
      return map;
    },
  });

  const getReclamante = (item: ItemAgendaUnificado) =>
    (item.processo_id ? processoInfo[item.processo_id]?.polo_ativo : null) || item.partes_ativas || "-";

  const getCliente = (item: ItemAgendaUnificado) =>
    (item.processo_id ? processoInfo[item.processo_id]?.cliente : null) || "-";

  const membros = useMemo<MembroStats[]>(() => {
    const map = new Map<string, MembroStats>();
    itens.forEach((item) => {
      const pessoas = getPessoas(item);
      const alvo = pessoas.length ? pessoas : [{ id: "__sem__", nome: "Não atribuído" }];
      alvo.forEach(({ id, nome }) => {
        if (!map.has(id)) {
          map.set(id, { id, nome, total: 0, pendentes: 0, atrasadas: 0, cumpridas: 0, itens: [] });
        }
        const m = map.get(id)!;
        m.total += 1;
        m.itens.push(item);
        if (isItemTratado(item)) {
          m.cumpridas += 1;
        } else {
          const d = getRefDate(item);
          if (d && differenceInCalendarDays(d, new Date()) < 0) m.atrasadas += 1;
          else m.pendentes += 1;
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [itens]);

  const membroAtual = membros.find((m) => m.id === selectedMembro) || null;

  const listaItens = useMemo(() => {
    const base = membroAtual ? membroAtual.itens : itens;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (i) =>
        i.titulo?.toLowerCase().includes(q) ||
        i.descricao?.toLowerCase().includes(q) ||
        i.processo?.numero?.toLowerCase().includes(q)
    );
  }, [membroAtual, itens, search]);

  const statusBadge = (item: ItemAgendaUnificado) => {
    if (isItemTratado(item)) {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Concluída
        </Badge>
      );
    }
    const d = getRefDate(item);
    if (d && differenceInCalendarDays(d, new Date()) < 0) {
      return (
        <Badge className="bg-destructive/10 text-destructive text-xs">
          <XCircle className="w-3 h-3 mr-1" /> Atrasado
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
        <Clock className="w-3 h-3 mr-1" /> Pendente
      </Badge>
    );
  };

  const diasRestantes = (item: ItemAgendaUnificado) => {
    if (isItemTratado(item)) return null;
    const d = getRefDate(item);
    if (!d) return <span className="text-muted-foreground">-</span>;
    const dias = differenceInCalendarDays(d, new Date());
    if (dias < 0) return <span className="text-destructive font-medium">{Math.abs(dias)}d atraso</span>;
    if (dias === 0) return <span className="text-amber-600 font-medium">Hoje</span>;
    if (dias <= 3) return <span className="text-amber-600">{dias}d</span>;
    return <span className="text-muted-foreground">{dias}d</span>;
  };

  return (
    <div className="space-y-4">
      {/* Cards por membro */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {membros.map((m) => {
          const taxa = m.total > 0 ? Math.round((m.cumpridas / m.total) * 100) : 0;
          return (
            <Card
              key={m.id}
              onClick={() => setSelectedMembro(selectedMembro === m.id ? null : m.id)}
              className={cn(
                "bg-card border-border/50 hover:shadow-md transition-shadow cursor-pointer",
                m.atrasadas > 0 && "border-l-4 border-l-destructive",
                selectedMembro === m.id && "ring-2 ring-primary"
              )}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(m.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{m.nome}</h4>
                    <p className="text-xs text-muted-foreground">{m.total} item(ns)</p>
                  </div>
                  {m.atrasadas > 0 && (
                    <Badge variant="destructive" className="text-xs">{m.atrasadas} atrasada{m.atrasadas > 1 ? "s" : ""}</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Conclusão</span>
                    <span className="font-medium">{taxa}%</span>
                  </div>
                  <Progress value={taxa} className="h-2" />
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <div className="text-center">
                      <p className="text-base font-bold">{m.total}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-amber-600">{m.pendentes}</p>
                      <p className="text-[10px] text-muted-foreground">Pend.</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-destructive">{m.atrasadas}</p>
                      <p className="text-[10px] text-muted-foreground">Atras.</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-emerald-600">{m.cumpridas}</p>
                      <p className="text-[10px] text-muted-foreground">Cumpr.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {membros.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Nenhum membro encontrado com os filtros atuais</p>
          </div>
        )}
      </div>

      {/* Lista de itens */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={membroAtual ? `Buscar em ${membroAtual.nome}...` : "Buscar item..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-8 text-xs"
        />
      </div>

      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Responsáveis</TableHead>
              <TableHead>Reclamante</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Processo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listaItens.map((item) => {
              const d = getRefDate(item);
              const pessoas = getPessoas(item);
              return (
                <TableRow
                  key={`${item.origem}-${item.id}`}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => onItemClick(item)}
                >
                  <TableCell>
                    <div className="max-w-[260px]">
                      <p className="font-medium truncate text-sm">{item.titulo}</p>
                      {item.descricao && (
                        <p className="text-xs text-muted-foreground truncate">{item.descricao}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm truncate block max-w-[180px]">
                      {pessoas.length ? pessoas.map((p) => p.nome).join(", ") : "Não atribuído"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm truncate block max-w-[200px]" title={getReclamante(item)}>
                      {getReclamante(item)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm truncate block max-w-[180px]" title={getCliente(item)}>
                      {getCliente(item)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.processo?.numero || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "-"}
                  </TableCell>
                  <TableCell className="text-sm">{diasRestantes(item)}</TableCell>
                  <TableCell>{statusBadge(item)}</TableCell>
                </TableRow>
              );
            })}
            {listaItens.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  <ListTodo className="w-9 h-9 mx-auto mb-2 opacity-50" />
                  Nenhum item encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
