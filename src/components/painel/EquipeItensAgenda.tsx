import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ItemAgendaUnificado } from "@/hooks/useAgendaUnificada";
import { isItemTratado } from "@/components/shared/TratadoCheck";
import { AtividadeBadge } from "@/components/comum/AtividadeBadge";
import { useItensComAtividades, getItemRawId } from "@/hooks/useItensComAtividades";
import { Users, Search, CheckCircle2, Clock, XCircle, ListTodo, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, isValid, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EquipeItensAgendaProps {
  itens: ItemAgendaUnificado[];
  onItemClick: (item: ItemAgendaUnificado) => void;
  /** Estado dos filtros controlado pelo pai, para não perder a seleção ao abrir/salvar um item */
  selectedMembro?: string | null;
  onSelectedMembroChange?: (id: string | null) => void;
  search?: string;
  onSearchChange?: (v: string) => void;
  pagina?: number;
  onPaginaChange?: (p: number) => void;
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

interface PessoaItem {
  id: string;
  nome: string;
}

interface PessoasPorPapel {
  responsaveis: PessoaItem[];
  envolvidos: PessoaItem[];
}

const TIPO_BAR_CLASSES: Record<string, string> = {
  evento: "bg-green-500",
  tarefa: "bg-blue-500",
  tarefa_delegada: "bg-blue-600",
  prazo: "bg-red-500",
  audiencia: "bg-yellow-500",
  prazo_parcela: "bg-red-400",
  parcelamento: "bg-emerald-500",
};

function getRefDate(item: ItemAgendaUnificado): Date | null {
  const raw = item.data_fatal ?? item.data_vencimento ?? item.data_inicio;
  if (!raw) return null;
  const d = parseISO(raw);
  return isValid(d) ? d : null;
}

function isItemCancelado(item: ItemAgendaUnificado): boolean {
  const normalize = (v?: string | null) =>
    (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const anyItem = item as unknown as { status?: string | null; situacao?: string | null; status_tst?: string | null };
  return [anyItem.status, anyItem.situacao, anyItem.status_tst].some((v) =>
    ["cancelado", "cancelada"].includes(normalize(v)),
  );
}

function getBaseId(id: string) {
  return id.split("::")[0];
}

function getPessoaLookupKey(item: ItemAgendaUnificado) {
  if (item.id.startsWith("audiencia-det-")) return `audiencia:${item.id.replace("audiencia-det-", "")}`;
  if (item.origem === "tarefa") return `tarefa:${getBaseId(item.id)}`;
  if (item.grupo_parcelas) return `evento:${item.grupo_parcelas}`;
  if (item.origem === "evento" && !item.id.startsWith("parcela-") && !item.id.startsWith("prazo-tst-")) {
    return `evento:${getBaseId(item.id)}`;
  }
  return null;
}

function addPessoa(map: Map<string, string>, pessoa?: PessoaItem | null) {
  if (!pessoa?.id) return;
  map.set(pessoa.id, pessoa.nome || "Sem nome");
}

function getPessoasPorPapel(item: ItemAgendaUnificado, extra?: PessoasPorPapel): PessoasPorPapel {
  const responsaveis = new Map<string, string>();
  const envolvidos = new Map<string, string>();

  addPessoa(responsaveis, item.responsavel);
  (extra?.responsaveis || []).forEach((p) => addPessoa(responsaveis, p));
  (item.participantes || []).forEach((p) => addPessoa(envolvidos, { id: p.usuario_id, nome: p.usuario?.nome || "Sem nome" }));
  (extra?.envolvidos || []).forEach((p) => addPessoa(envolvidos, p));

  return {
    responsaveis: Array.from(responsaveis, ([id, nome]) => ({ id, nome })),
    envolvidos: Array.from(envolvidos, ([id, nome]) => ({ id, nome })).filter((p) => !responsaveis.has(p.id)),
  };
}

function getPessoas(item: ItemAgendaUnificado, extra?: PessoasPorPapel): PessoaItem[] {
  const pessoas = getPessoasPorPapel(item, extra);
  return [...pessoas.responsaveis, ...pessoas.envolvidos];
}

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const ITENS_POR_PAGINA = 50;

export function EquipeItensAgenda({
  itens,
  onItemClick,
  selectedMembro: selectedMembroProp,
  onSelectedMembroChange,
  search: searchProp,
  onSearchChange,
  pagina: paginaProp,
  onPaginaChange,
}: EquipeItensAgendaProps) {
  const [selectedMembroLocal, setSelectedMembroLocal] = useState<string | null>(null);
  const [searchLocal, setSearchLocal] = useState("");
  const [paginaLocal, setPaginaLocal] = useState(1);

  const selectedMembro = selectedMembroProp !== undefined ? selectedMembroProp : selectedMembroLocal;
  const setSelectedMembro = onSelectedMembroChange ?? setSelectedMembroLocal;
  const search = searchProp !== undefined ? searchProp : searchLocal;
  const setSearch = onSearchChange ?? setSearchLocal;
  const pagina = paginaProp !== undefined ? paginaProp : paginaLocal;
  const setPagina = onPaginaChange ?? setPaginaLocal;

  const pessoaLookupIds = useMemo(() => {
    const tarefas = new Set<string>();
    const eventos = new Set<string>();
    const audiencias = new Set<string>();

    itens.forEach((item) => {
      const key = getPessoaLookupKey(item);
      if (!key) return;
      const [tipo, id] = key.split(":");
      if (!id) return;
      if (tipo === "tarefa") tarefas.add(id);
      if (tipo === "evento") eventos.add(id);
      if (tipo === "audiencia") audiencias.add(id);
    });

    return {
      tarefas: Array.from(tarefas),
      eventos: Array.from(eventos),
      audiencias: Array.from(audiencias),
    };
  }, [itens]);

  const { data: pessoasExtras = {} as Record<string, PessoasPorPapel> } = useQuery<Record<string, PessoasPorPapel>>({
    queryKey: ["equipe-pessoas-extras", pessoaLookupIds],
    enabled: pessoaLookupIds.tarefas.length + pessoaLookupIds.eventos.length + pessoaLookupIds.audiencias.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const result: Record<string, PessoasPorPapel> = {};
      const userIds = new Set<string>();
      const ensure = (key: string) => {
        if (!result[key]) result[key] = { responsaveis: [], envolvidos: [] };
        return result[key];
      };

      const [tarefaResp, tarefaEnv, eventoResp, eventoEnv, audienciaResp, audienciaEnv] = await Promise.all([
        pessoaLookupIds.tarefas.length
          ? supabase.from("tarefa_responsaveis").select("tarefa_id, usuario_id").in("tarefa_id", pessoaLookupIds.tarefas)
          : Promise.resolve({ data: [], error: null }),
        pessoaLookupIds.tarefas.length
          ? supabase.from("tarefa_envolvidos").select("tarefa_id, usuario_id").in("tarefa_id", pessoaLookupIds.tarefas)
          : Promise.resolve({ data: [], error: null }),
        pessoaLookupIds.eventos.length
          ? supabase.from("evento_responsaveis").select("evento_id, usuario_id").in("evento_id", pessoaLookupIds.eventos)
          : Promise.resolve({ data: [], error: null }),
        pessoaLookupIds.eventos.length
          ? supabase.from("evento_envolvidos").select("evento_id, usuario_id").in("evento_id", pessoaLookupIds.eventos)
          : Promise.resolve({ data: [], error: null }),
        pessoaLookupIds.audiencias.length
          ? supabase.from("audiencias_advogados").select("audiencia_id, advogado_id").in("audiencia_id", pessoaLookupIds.audiencias)
          : Promise.resolve({ data: [], error: null }),
        pessoaLookupIds.audiencias.length
          ? supabase.from("audiencia_envolvidos").select("audiencia_id, usuario_id").in("audiencia_id", pessoaLookupIds.audiencias)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const responses = [tarefaResp, tarefaEnv, eventoResp, eventoEnv, audienciaResp, audienciaEnv];
      const firstError = responses.find((res) => res.error)?.error;
      if (firstError) throw firstError;

      (tarefaResp.data || []).forEach((row: any) => {
        if (!row.tarefa_id || !row.usuario_id) return;
        ensure(`tarefa:${row.tarefa_id}`).responsaveis.push({ id: row.usuario_id, nome: "" });
        userIds.add(row.usuario_id);
      });
      (tarefaEnv.data || []).forEach((row: any) => {
        if (!row.tarefa_id || !row.usuario_id) return;
        ensure(`tarefa:${row.tarefa_id}`).envolvidos.push({ id: row.usuario_id, nome: "" });
        userIds.add(row.usuario_id);
      });
      (eventoResp.data || []).forEach((row: any) => {
        if (!row.evento_id || !row.usuario_id) return;
        ensure(`evento:${row.evento_id}`).responsaveis.push({ id: row.usuario_id, nome: "" });
        userIds.add(row.usuario_id);
      });
      (eventoEnv.data || []).forEach((row: any) => {
        if (!row.evento_id || !row.usuario_id) return;
        ensure(`evento:${row.evento_id}`).envolvidos.push({ id: row.usuario_id, nome: "" });
        userIds.add(row.usuario_id);
      });
      (audienciaResp.data || []).forEach((row: any) => {
        if (!row.audiencia_id || !row.advogado_id) return;
        ensure(`audiencia:${row.audiencia_id}`).responsaveis.push({ id: row.advogado_id, nome: "" });
        userIds.add(row.advogado_id);
      });
      (audienciaEnv.data || []).forEach((row: any) => {
        if (!row.audiencia_id || !row.usuario_id) return;
        ensure(`audiencia:${row.audiencia_id}`).envolvidos.push({ id: row.usuario_id, nome: "" });
        userIds.add(row.usuario_id);
      });

      if (userIds.size > 0) {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", Array.from(userIds));
        if (error) throw error;

        const names = new Map((profiles || []).map((p: any) => [p.id, p.nome || "Sem nome"]));
        Object.values(result).forEach((grupo) => {
          grupo.responsaveis = grupo.responsaveis.map((p) => ({ ...p, nome: names.get(p.id) || "Sem nome" }));
          grupo.envolvidos = grupo.envolvidos.map((p) => ({ ...p, nome: names.get(p.id) || "Sem nome" }));
        });
      }

      return result;
    },
  });

  const membros = useMemo<MembroStats[]>(() => {
    const map = new Map<string, MembroStats>();
    itens.forEach((item) => {
      const key = getPessoaLookupKey(item);
      const pessoas = getPessoas(item, key ? pessoasExtras[key] : undefined);
      const alvo = pessoas.length ? pessoas : [{ id: "__sem__", nome: "Não atribuído" }];
      alvo.forEach(({ id, nome }) => {
        if (!map.has(id)) {
          map.set(id, { id, nome, total: 0, pendentes: 0, atrasadas: 0, cumpridas: 0, itens: [] });
        }
        const m = map.get(id);
        if (!m) return;
        m.total += 1;
        m.itens.push(item);
        if (isItemCancelado(item)) {
          // itens cancelados não entram em atrasados/pendentes
        } else if (isItemTratado(item)) {
          m.cumpridas += 1;
        } else {
          const d = getRefDate(item);
          if (d && differenceInCalendarDays(d, new Date()) < 0) m.atrasadas += 1;
          else m.pendentes += 1;
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [itens, pessoasExtras]);

  const membroAtual = membros.find((m) => m.id === selectedMembro) || null;

  const listaItens = useMemo(() => {
    const base = membroAtual ? membroAtual.itens : itens;
    const q = search.trim().toLowerCase();
    const filtrada = !q
      ? base
      : base.filter(
          (i) =>
            i.titulo?.toLowerCase().includes(q) ||
            i.descricao?.toLowerCase().includes(q) ||
            i.processo?.numero?.toLowerCase().includes(q)
        );
    // Ordena por data crescente: atrasados e de hoje no topo, futuros depois
    const ts = (i: any) => {
      const t = new Date(i?.data_inicio).getTime();
      return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
    };
    return [...filtrada].sort((a, b) => ts(a) - ts(b));
  }, [membroAtual, itens, search]);

  const totalPaginas = Math.max(1, Math.ceil(listaItens.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const itensPagina = useMemo(
    () => listaItens.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA),
    [listaItens, paginaAtual]
  );

  // Volta para a primeira página apenas quando o membro/busca realmente mudam
  // (não em remontagens nem ao salvar um item, para preservar os filtros).
  const filtroAnteriorRef = useRef<string | null>(null);
  useEffect(() => {
    const chave = `${selectedMembro ?? ""}|${search}`;
    if (filtroAnteriorRef.current === null) {
      filtroAnteriorRef.current = chave;
      return;
    }
    if (filtroAnteriorRef.current !== chave) {
      filtroAnteriorRef.current = chave;
      setPagina(1);
    }
  }, [selectedMembro, search, setPagina]);

  const processoIds = useMemo(
    () => Array.from(new Set(itensPagina.map((i) => i.processo_id).filter(Boolean))) as string[],
    [itensPagina]
  );

  const { data: processoInfo = {} } = useQuery({
    queryKey: ["equipe-processos-info", processoIds.join(",")],
    enabled: processoIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map: Record<string, { polo_ativo?: string | null; cliente?: string | null }> = {};
      const { data, error } = await supabase
        .from("processos")
        .select("id, polo_ativo, cliente:clientes!processos_cliente_id_fkey(nome)")
        .in("id", processoIds);
      if (error) throw error;
      (data || []).forEach((p: any) => {
        map[p.id] = { polo_ativo: p.polo_ativo, cliente: p.cliente?.nome ?? null };
      });
      return map;
    },
  });

  const getReclamante = (item: ItemAgendaUnificado) =>
    (item.processo_id ? processoInfo[item.processo_id]?.polo_ativo : null) || item.partes_ativas || "-";

  const getCliente = (item: ItemAgendaUnificado) =>
    (item.processo_id ? processoInfo[item.processo_id]?.cliente : null) || "-";

  const statusBadge = (item: ItemAgendaUnificado) => {
    if (isItemCancelado(item)) {
      return (
        <Badge className="bg-muted text-muted-foreground text-xs">
          <XCircle className="w-3 h-3 mr-1" /> Cancelado
        </Badge>
      );
    }
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
    if (isItemTratado(item) || isItemCancelado(item)) return null;
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
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
              <CardContent className="p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      {getInitials(m.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-xs truncate leading-tight">{m.nome}</h4>
                    <p className="text-[10px] text-muted-foreground leading-tight">{m.total} item(ns)</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Progress value={taxa} className="h-1" />
                  <div className="flex items-center justify-between text-[10px] font-semibold">
                    <span title="Pendentes" className="text-amber-600">{m.pendentes}p</span>
                    <span title="Atrasadas" className="text-destructive">{m.atrasadas}a</span>
                    <span title="Cumpridas" className="text-emerald-600">{m.cumpridas}c</span>
                    <span className="text-muted-foreground font-medium">{taxa}%</span>
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
              <TableHead>Responsáveis e envolvidos</TableHead>
              <TableHead>Processo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itensPagina.map((item) => {
              const d = getRefDate(item);
              const key = getPessoaLookupKey(item);
              const pessoasPorPapel = getPessoasPorPapel(item, key ? pessoasExtras[key] : undefined);
              const pessoas = [...pessoasPorPapel.responsaveis, ...pessoasPorPapel.envolvidos];
              return (
                <TableRow
                  key={`${item.origem}-${item.id}`}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => onItemClick(item)}
                >
                  <TableCell className="relative pl-4">
                    <span
                      aria-hidden="true"
                      className={cn("absolute left-0 top-0 h-full w-1", TIPO_BAR_CLASSES[item.tipo] || "bg-muted")}
                    />
                    <div className="max-w-[260px]">
                      <p className="font-medium truncate text-sm" title={item.titulo || undefined}>{item.titulo || "(sem título)"}</p>
                      {item.descricao && (
                        <p className="text-xs text-muted-foreground truncate">{item.descricao}</p>
                      )}
                      {getReclamante(item) !== "-" && (
                        <p className="text-xs text-muted-foreground truncate" title={getReclamante(item)}>
                          Reclamante: {getReclamante(item)}
                        </p>
                      )}
                      {getCliente(item) !== "-" && (
                        <p className="text-xs text-muted-foreground truncate" title={getCliente(item)}>
                          Cliente: {getCliente(item)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {pessoas.length ? (
                      <div className="max-w-[280px] space-y-1 text-xs" title={pessoas.map((p) => p.nome).join(", ")}>
                        {pessoasPorPapel.responsaveis.length > 0 && (
                          <p className="line-clamp-2">
                            <span className="font-semibold">Responsáveis:</span>{" "}
                            {pessoasPorPapel.responsaveis.map((p) => p.nome).join(", ")}
                          </p>
                        )}
                        {pessoasPorPapel.envolvidos.length > 0 && (
                          <p className="line-clamp-2 text-muted-foreground">
                            <span className="font-semibold text-foreground">Envolvidos:</span>{" "}
                            {pessoasPorPapel.envolvidos.map((p) => p.nome).join(", ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Não atribuído</span>
                    )}
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
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <ListTodo className="w-9 h-9 mx-auto mb-2 opacity-50" />
                  Nenhum item encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {listaItens.length > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Mostrando {(paginaAtual - 1) * ITENS_POR_PAGINA + 1}–
            {Math.min(paginaAtual * ITENS_POR_PAGINA, listaItens.length)} de {listaItens.length} item(ns)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
