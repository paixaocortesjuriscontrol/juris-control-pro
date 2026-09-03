import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, Scale, ClipboardList, CalendarDays, Gavel, Newspaper, UserCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { obterVariantesCnjBusca } from "@/utils/cnjMask";

type Resultado = {
  id: string;
  tipo: "processo" | "cliente" | "tarefa" | "prazo" | "evento" | "audiencia" | "publicacao";
  titulo: string;
  subtitulo?: string;
  to: string;
};

const TIPO_META: Record<Resultado["tipo"], { label: string; icon: any; color: string }> = {
  processo:   { label: "Processo",   icon: Scale,         color: "text-sky-500" },
  cliente:    { label: "Cliente",    icon: UserCircle,    color: "text-emerald-500" },
  tarefa:     { label: "Tarefa",     icon: ClipboardList, color: "text-amber-500" },
  prazo:      { label: "Prazo",      icon: ClipboardList, color: "text-red-500" },
  evento:     { label: "Evento",     icon: CalendarDays,  color: "text-blue-500" },
  audiencia:  { label: "Audiência",  icon: Gavel,         color: "text-purple-500" },
  publicacao: { label: "Publicação", icon: Newspaper,     color: "text-fuchsia-500" },
};

function escapeIlike(s: string) {
  return s.replace(/[%,()]/g, " ").trim();
}

function normalizeSearchTerm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildOr(columns: string[], terms: string[]) {
  const uniqueTerms = Array.from(new Set(terms.map(escapeIlike).filter((term) => term.length >= 2)));
  return columns.flatMap((column) => uniqueTerms.map((term) => `${column}.ilike.%${term}%`)).join(",");
}

/** Variantes do número do processo (com e sem máscara CNJ) para busca. */
function variantesNumero(termo: string): string[] {
  return obterVariantesCnjBusca(termo)
    .map(escapeIlike)
    .filter((v) => v.replace(/\D/g, "").length >= 3);
}

export function BuscaGlobalPainel() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const executarBusca = async () => {
    const termo = escapeIlike(query);
    if (termo.length < 2) return;
    setOpen(true);
    setLoading(true);
    setHasSearched(true);
    const termosBusca = [termo, normalizeSearchTerm(termo)];
    const like = `%${termo}%`;
    const digitsOnly = termo.replace(/\D/g, "");
    const numeroVariantes = variantesNumero(termo);
    const numeroOr = (coluna: string) =>
      numeroVariantes.map((v) => `${coluna}.ilike.%${v}%`).join(",");
    try {
        const [proc, cli, tar, evt, aud, pub] = await Promise.all([
          supabase
            .from("processos")
            .select("id, numero, assunto, polo_ativo, polo_passivo")
            .or(
              [
                ...(numeroVariantes.length > 0 ? [numeroOr("numero")] : [`numero.ilike.${like}`]),
                `assunto.ilike.${like}`,
                `polo_ativo.ilike.${like}`,
                `polo_passivo.ilike.${like}`,
              ]
                .filter(Boolean)
                .join(",")
            )
            .limit(8),
          supabase
            .from("clientes")
            .select("id, nome, cpf_cnpj")
            .or(buildOr(["nome", "cpf_cnpj"], termosBusca))
            .limit(5),
          supabase
            .from("tarefas")
            .select("id, titulo, descricao, tipo_tarefa, data_vencimento, data_fatal, status, observacoes, descricao_ultimo_andamento, partes_ativas, partes_passivas, envolvimento_clientes, envolvimento_contrarios")
            .or(
              buildOr(
                [
                  "titulo",
                  "descricao",
                  "tipo_tarefa",
                  "observacoes",
                  "descricao_ultimo_andamento",
                  "partes_ativas",
                  "partes_passivas",
                  "envolvimento_clientes",
                  "envolvimento_contrarios",
                ],
                termosBusca
              )
            )
            .order("data_vencimento", { ascending: true, nullsFirst: false })
            .limit(30),
          supabase
            .from("eventos_agenda")
            .select("id, titulo, descricao, data_inicio")
            .or(buildOr(["titulo", "descricao", "local", "modalidade", "tipo"], termosBusca))
            .order("data_inicio", { ascending: true })
            .limit(20),
          supabase
            .from("audiencias_detectadas")
            .select("id, processo_numero, data_audiencia, tipo_audiencia, titulo, cliente, polo_ativo, preposto, testemunhas")
            .or(
              [
                ...(numeroVariantes.length > 0 ? [numeroOr("processo_numero")] : []),
                buildOr(
                  [
                    "titulo",
                    "tipo_audiencia",
                    "cliente",
                    "polo_ativo",
                    "terceirizado",
                    "preposto",
                    "testemunhas",
                    "advogado",
                    "funcao",
                    "resumo_objeto",
                    "vara_camara",
                    "comarca",
                    "forum",
                    "local_audiencia",
                    "modalidade",
                    "observacoes",
                  ],
                  termosBusca
                ),
              ]
                .filter(Boolean)
                .join(",")
            )
            .order("data_audiencia", { ascending: false })
            .limit(20),

          // Item 09: fora da Análise DJEN a busca global só traz publicações
          // quando o termo é um número de processo. Buscar por texto livre
          // (ex.: sigla do tribunal) inundava o resultado com publicações.
          numeroVariantes.length > 0
            ? supabase
                .from("publicacoes_djen")
                .select("id, processo_numero, data_disponibilizacao, tribunal")
                .or(numeroOr("processo_numero"))
                .limit(5)
            : Promise.resolve({ data: [] as any[], error: null } as any),

        ]);

        const out: Resultado[] = [];

        (proc.data || []).forEach((p: any) =>
          out.push({
            id: `p-${p.id}`,
            tipo: "processo",
            titulo: p.numero || "(sem número)",
            subtitulo: [p.assunto, p.polo_ativo && `${p.polo_ativo} x ${p.polo_passivo ?? ""}`]
              .filter(Boolean)
              .join(" • "),
            to: `/processos/${p.id}`,
          })
        );
        (cli.data || []).forEach((c: any) =>
          out.push({
            id: `c-${c.id}`,
            tipo: "cliente",
            titulo: c.nome,
            subtitulo: c.cpf_cnpj || undefined,
            to: `/clientes/${c.id}`,
          })
        );
        (tar.data || []).forEach((t: any) =>
          out.push({
            id: `t-${t.id}`,
            tipo: (t.tipo_tarefa || "").toLowerCase().includes("prazo") ? "prazo" : "tarefa",
            titulo: t.titulo,
            subtitulo: [t.tipo_tarefa, t.status, t.data_vencimento || t.data_fatal, t.descricao].filter(Boolean).join(" • "),
            to: `/painel-controle?selectedId=${t.id}&origem=tarefa`,
          })
        );
        (evt.data || []).forEach((e: any) =>
          out.push({
            id: `e-${e.id}`,
            tipo: "evento",
            titulo: e.titulo,
            subtitulo: e.data_inicio,
            to: `/painel-controle?selectedId=${e.id}&origem=evento`,
          })
        );
        (aud.data || []).forEach((a: any) =>
          out.push({
            id: `a-${a.id}`,
            tipo: "audiencia",
            titulo: a.processo_numero || "(audiência)",
            subtitulo: [
              a.titulo || a.tipo_audiencia,
              a.data_audiencia,
              a.cliente,
              a.preposto && `Preposto: ${a.preposto}`,
              a.testemunhas && `Testemunhas: ${a.testemunhas}`,
            ]
              .filter(Boolean)
              .join(" • "),

            to: `/painel-audiencias`,
          })
        );
        (pub.data || []).forEach((p: any) =>
          out.push({
            id: `pu-${p.id}`,
            tipo: "publicacao",
            titulo: p.processo_numero || "(publicação)",
            subtitulo: [p.tribunal, p.data_disponibilizacao].filter(Boolean).join(" • "),
            to: `/analise-djen?processo=${encodeURIComponent(
              (p.processo_numero || "").replace(/\D/g, "")
            )}&pubId=${p.id}`,
          })
        );

        setResultados(out);
      } catch (err) {
        console.error("[busca-global]", err);
      } finally {
        setLoading(false);
      }
  };

  const go = (r: Resultado) => {
    setOpen(false);
    navigate(r.to);
  };

  const grupos = useMemo(() => {
    const map = new Map<Resultado["tipo"], Resultado[]>();
    resultados.forEach((r) => {
      if (!map.has(r.tipo)) map.set(r.tipo, []);
      map.get(r.tipo)!.push(r);
    });
    return Array.from(map.entries());
  }, [resultados]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 w-64 md:w-96">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (hasSearched) setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                executarBusca();
              }
            }}
            placeholder="Buscar processo, cliente, tarefa…"
            className="h-9 pl-8 pr-8 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setOpen(false); setHasSearched(false); setResultados([]); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          onClick={executarBusca}
          disabled={query.trim().length < 2 || loading}
          className="h-9"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
          Pesquisar
        </Button>
      </div>

      {open && hasSearched && (
        <div className="absolute z-50 top-full mt-2 right-0 w-[min(720px,calc(100vw-32px))] rounded-lg border border-border bg-popover shadow-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Resultados para</span>
              <span className="font-medium text-foreground">"{query}"</span>
              {!loading && (
                <Badge variant="secondary" className="ml-1">
                  {resultados.length} {resultados.length === 1 ? "item" : "itens"}
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /> Buscando…
              </div>
            )}
            {!loading && resultados.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado.
              </div>
            )}
            {!loading &&
              grupos.map(([tipo, items]) => {
                const meta = TIPO_META[tipo];
                const Icon = meta.icon;
                return (
                  <div key={tipo} className="border-b last:border-b-0">
                    <div className="px-4 py-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 sticky top-0 z-10">
                      <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                      {meta.label}
                      <span className="text-muted-foreground/70 font-normal normal-case">
                        ({items.length})
                      </span>
                    </div>
                    <div className="divide-y">
                      {items.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => go(r)}
                          className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-accent transition-colors group"
                        >
                          <div className={cn("mt-0.5 p-1.5 rounded-md bg-muted group-hover:bg-background", meta.color)}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">
                              {r.titulo}
                            </div>
                            {r.subtitulo && (
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {r.subtitulo}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 self-center whitespace-nowrap">
                            Abrir →
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}