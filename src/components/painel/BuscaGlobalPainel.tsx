import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, Scale, ClipboardList, CalendarDays, Gavel, Newspaper, UserCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const termo = useMemo(() => escapeIlike(query), [query]);

  useEffect(() => {
    if (termo.length < 2) {
      setResultados([]);
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    const t = setTimeout(async () => {
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

        if (cancel) return;

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
        setActiveIdx(0);
      } catch (err) {
        console.error("[busca-global]", err);
      } finally {
        if (!cancel) setLoading(false);
      }
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [termo]);

  const go = (r: Resultado) => {
    setOpen(false);
    setQuery("");
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
    <div ref={containerRef} className="relative w-64 md:w-80">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, resultados.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && resultados[activeIdx]) {
              e.preventDefault();
              go(resultados[activeIdx]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Buscar processo, tarefa, prazo…"
          className="h-9 pl-8 pr-8 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResultados([]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute z-50 mt-2 w-[min(28rem,90vw)] right-0 md:right-auto md:left-0 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Buscando…
              </div>
            )}
            {!loading && resultados.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">Nenhum resultado encontrado.</div>
            )}
            {!loading && grupos.map(([tipo, items]) => {
              const meta = TIPO_META[tipo];
              const Icon = meta.icon;
              return (
                <div key={tipo} className="py-1">
                  <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/40">
                    {meta.label}
                  </div>
                  {items.map((r) => {
                    const idx = resultados.indexOf(r);
                    return (
                      <button
                        key={r.id}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => go(r)}
                        className={cn(
                          "w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-accent transition-colors",
                          idx === activeIdx && "bg-accent"
                        )}
                      >
                        <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", meta.color)} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate">{r.titulo}</div>
                          {r.subtitulo && (
                            <div className="text-xs text-muted-foreground truncate">{r.subtitulo}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}