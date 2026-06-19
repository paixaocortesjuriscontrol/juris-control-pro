import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, Scale, ClipboardList, CalendarDays, Gavel, Newspaper, UserCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

export function BuscaGlobalPainel() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const executarBusca = async () => {
    const termo = escapeIlike(query);
    if (termo.length < 2) return;
    setOpen(true);
    setLoading(true);
    setHasSearched(true);
    const like = `%${termo}%`;
    const digitsOnly = termo.replace(/\D/g, "");
    try {
        const [proc, cli, tar, evt, aud, pub] = await Promise.all([
          supabase
            .from("processos")
            .select("id, numero, assunto, polo_ativo, polo_passivo")
            .or(
              [
                `numero.ilike.${like}`,
                `assunto.ilike.${like}`,
                `polo_ativo.ilike.${like}`,
                `polo_passivo.ilike.${like}`,
              ].join(",")
            )
            .limit(8),
          supabase.from("clientes").select("id, nome, documento").ilike("nome", like).limit(5),
          supabase
            .from("tarefas")
            .select("id, titulo, tipo, data_vencimento, status")
            .ilike("titulo", like)
            .limit(8),
          supabase
            .from("eventos_agenda")
            .select("id, titulo, data_inicio")
            .ilike("titulo", like)
            .limit(5),
          supabase
            .from("audiencias_detectadas")
            .select("id, processo_numero, data_audiencia, tipo_audiencia")
            .or(
              digitsOnly.length >= 3
                ? `processo_numero.ilike.%${digitsOnly}%,tipo_audiencia.ilike.${like}`
                : `tipo_audiencia.ilike.${like}`
            )
            .limit(5),
          supabase
            .from("publicacoes_djen")
            .select("id, processo_numero, data_disponibilizacao, tribunal")
            .or(
              digitsOnly.length >= 3
                ? `processo_numero.ilike.%${digitsOnly}%,tribunal.ilike.${like}`
                : `tribunal.ilike.${like}`
            )
            .limit(5),
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
            subtitulo: c.documento || undefined,
            to: `/clientes/${c.id}`,
          })
        );
        (tar.data || []).forEach((t: any) =>
          out.push({
            id: `t-${t.id}`,
            tipo: t.tipo === "prazo" ? "prazo" : "tarefa",
            titulo: t.titulo,
            subtitulo: [t.status, t.data_vencimento].filter(Boolean).join(" • "),
            to: `/minha-agenda`,
          })
        );
        (evt.data || []).forEach((e: any) =>
          out.push({
            id: `e-${e.id}`,
            tipo: "evento",
            titulo: e.titulo,
            subtitulo: e.data_inicio,
            to: `/minha-agenda`,
          })
        );
        (aud.data || []).forEach((a: any) =>
          out.push({
            id: `a-${a.id}`,
            tipo: "audiencia",
            titulo: a.processo_numero || "(audiência)",
            subtitulo: [a.tipo_audiencia, a.data_audiencia].filter(Boolean).join(" • "),
            to: `/painel-audiencias`,
          })
        );
        (pub.data || []).forEach((p: any) =>
          out.push({
            id: `pu-${p.id}`,
            tipo: "publicacao",
            titulo: p.processo_numero || "(publicação)",
            subtitulo: [p.tribunal, p.data_disponibilizacao].filter(Boolean).join(" • "),
            to: `/analise-djen`,
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
    <>
      <div className="flex items-center gap-2 w-64 md:w-96">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
              onClick={() => setQuery("")}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Search className="w-4 h-4 text-muted-foreground" />
              Resultados para <span className="text-primary">"{query}"</span>
              {!loading && hasSearched && (
                <Badge variant="secondary" className="ml-2">
                  {resultados.length} {resultados.length === 1 ? "item" : "itens"}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /> Buscando…
              </div>
            )}
            {!loading && resultados.length === 0 && hasSearched && (
              <div className="p-12 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado.
              </div>
            )}
            {!loading &&
              grupos.map(([tipo, items]) => {
                const meta = TIPO_META[tipo];
                const Icon = meta.icon;
                return (
                  <div key={tipo} className="border-b last:border-b-0">
                    <div className="px-6 py-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 sticky top-0">
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
                          className="w-full text-left px-6 py-3 flex items-start gap-3 hover:bg-accent transition-colors group"
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
                          <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 self-center">
                            Abrir →
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}