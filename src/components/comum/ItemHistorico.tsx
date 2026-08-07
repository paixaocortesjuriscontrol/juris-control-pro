import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History, MessageSquareQuote } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TipoItemAtividade } from "./ItemAtividades";

interface Props {
  tipo: TipoItemAtividade;
  /** Tabela de comentários usada para as justificativas de mudança de situação */
  tipoComentario: "tarefa" | "evento" | "audiencia";
  itemId?: string | null;
  className?: string;
}

const COMENTARIOS: Record<string, { table: string; fk: string }> = {
  tarefa: { table: "comentarios_tarefas", fk: "tarefa_id" },
  evento: { table: "comentarios_eventos", fk: "evento_id" },
  audiencia: { table: "comentarios_audiencias", fk: "audiencia_id" },
};

type Entrada = {
  id: string;
  created_at: string;
  autorId: string | null;
  tipo: "auditoria" | "justificativa";
  acao?: string | null;
  origem?: string | null;
  campos?: Array<{ campo?: string; de?: any; para?: any; anterior?: any; novo?: any }>;
  texto?: string;
  situacaoDe?: string | null;
  situacaoPara?: string | null;
};

function normalizarCampos(v: any): Entrada["campos"] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    return Object.entries(v).map(([campo, val]: [string, any]) => ({
      campo,
      de: val?.de ?? val?.anterior,
      para: val?.para ?? val?.novo,
    }));
  }
  return [];
}

function fmtValor(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function ItemHistorico({ tipo, tipoComentario, itemId, className }: Props) {
  const cfg = COMENTARIOS[tipoComentario];

  const { data, isLoading } = useQuery({
    queryKey: ["item-historico", tipo, tipoComentario, itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const [aud, com] = await Promise.all([
        (supabase as any)
          .from("auditoria_tarefas")
          .select("id, created_at, usuario_id, acao, origem, campos_alterados, sucesso, erro_mensagem")
          .eq("tarefa_id", itemId)
          .order("created_at", { ascending: false })
          .limit(200),
        (supabase as any)
          .from(cfg.table)
          .select(`id, created_at, autor_id, conteudo`)
          .eq(cfg.fk, itemId)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const entradas: Entrada[] = [];

      (aud.data || []).forEach((r: any) => {
        entradas.push({
          id: `a-${r.id}`,
          created_at: r.created_at,
          autorId: r.usuario_id,
          tipo: "auditoria",
          acao: r.acao,
          origem: r.origem,
          campos: normalizarCampos(r.campos_alterados),
          texto: r.sucesso === false ? r.erro_mensagem : undefined,
        });
      });

      (com.data || []).forEach((c: any) => {
        const m = /^\[Situação:\s*(.*?)\s*→\s*(.*?)\]\s*([\s\S]*)$/.exec(c.conteudo || "");
        if (!m) return; // apenas justificativas de mudança de situação
        entradas.push({
          id: `c-${c.id}`,
          created_at: c.created_at,
          autorId: c.autor_id,
          tipo: "justificativa",
          situacaoDe: m[1],
          situacaoPara: m[2],
          texto: m[3]?.trim(),
        });
      });

      const autorIds = Array.from(new Set(entradas.map((e) => e.autorId).filter(Boolean))) as string[];
      let autores: Record<string, { nome?: string; email?: string }> = {};
      if (autorIds.length > 0) {
        const [{ data: perfisBasic }, { data: perfis }] = await Promise.all([
          (supabase as any).from("profiles_basic").select("id, nome").in("id", autorIds),
          (supabase as any).from("profiles").select("id, nome, email").in("id", autorIds),
        ]);
        (perfisBasic || []).forEach((p: any) => {
          autores[p.id] = { nome: p.nome };
        });
        (perfis || []).forEach((p: any) => {
          autores[p.id] = { nome: p.nome || autores[p.id]?.nome, email: p.email };
        });
      }

      entradas.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return { entradas, autores };
    },
  });

  if (!itemId) {
    return (
      <p className={cn("text-sm text-muted-foreground py-6 text-center", className)}>
        O histórico aparece depois que o item é salvo.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  const entradas = data?.entradas ?? [];
  const autores = data?.autores ?? {};

  if (entradas.length === 0) {
    return (
      <div className={cn("text-center py-6 text-sm text-muted-foreground", className)}>
        <History className="h-5 w-5 mx-auto mb-1 opacity-60" />
        Nenhuma alteração registrada
      </div>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {entradas.map((e) => {
        const autor = e.autorId ? autores[e.autorId] : undefined;
        return (
          <li key={e.id} className="rounded-md border p-2.5 bg-card text-xs space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{autor?.nome || autor?.email || "Sistema"}</span>
              {autor?.email && autor?.nome && (
                <span className="text-muted-foreground">{autor.email}</span>
              )}
              <span className="text-muted-foreground ml-auto">
                {format(parseISO(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            </div>

            {e.tipo === "justificativa" ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="secondary">Situação</Badge>
                  <span className="font-medium">{e.situacaoDe || "—"}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{e.situacaoPara || "—"}</span>
                </div>
                {e.texto && (
                  <p className="flex items-start gap-1.5 text-muted-foreground whitespace-pre-wrap">
                    <MessageSquareQuote className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    {e.texto}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline">{e.acao || "alteração"}</Badge>
                  {e.origem && <span className="text-muted-foreground">{e.origem}</span>}
                </div>
                {e.campos && e.campos.length > 0 && (
                  <ul className="space-y-0.5">
                    {e.campos.map((c, i) => (
                      <li key={i} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{c.campo}</span>:{" "}
                        {fmtValor(c.de ?? c.anterior)} <span className="mx-0.5">→</span>{" "}
                        {fmtValor(c.para ?? c.novo)}
                      </li>
                    ))}
                  </ul>
                )}
                {e.texto && <p className="text-destructive whitespace-pre-wrap">{e.texto}</p>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
