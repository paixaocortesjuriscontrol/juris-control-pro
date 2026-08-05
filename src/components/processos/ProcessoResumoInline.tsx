import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Resumo do processo exibido dentro do próprio formulário (prazo, tarefa,
 * evento). O botão "Detalhar" expande um card com os principais campos da
 * Visão Geral. Os dados são buscados apenas quando o usuário expande.
 */
const CAMPOS = [
  "id",
  "numero",
  "polo_ativo",
  "polo_passivo",
  "terceiro_envolvido",
  "reclamante",
  "reclamados",
  "autor",
  "requerido",
  "valor_causa",
  "valor_condenacao",
  "valor_provisionado",
  "tribunal",
  "vara",
  "comarca",
  "uf",
  "orgao_julgador",
  "status",
  "fase",
  "area",
  "materia",
  "tipo_processo",
  "data_distribuicao",
  "data_fatal",
  "objeto",
  "pedidos",
  "cliente_id",
].join(", ");

function fmtMoeda(v: unknown): string | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!isFinite(n) || n === 0) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function txt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) {
    const j = v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).filter(Boolean).join(", ");
    return j.trim() || null;
  }
  const s = String(v).trim();
  return s ? s : null;
}

function Campo({ label, valor }: { label: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div className="min-w-0">
      <span className="text-[11px] font-medium text-muted-foreground">{label}: </span>
      <span className="text-xs text-foreground break-words whitespace-pre-wrap">{valor}</span>
    </div>
  );
}

interface Props {
  processoId: string;
  className?: string;
  /** Renderiza somente o painel (o pai controla a abertura). */
  defaultOpen?: boolean;
}

export function ProcessoResumoInline({ processoId, className, defaultOpen = false }: Props) {
  const [aberto, setAberto] = useState(defaultOpen);

  const { data: p, isLoading } = useQuery({
    queryKey: ["processo-resumo-inline", processoId],
    enabled: !!processoId && aberto,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(CAMPOS)
        .eq("id", processoId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: cliente } = useQuery({
    queryKey: ["processo-resumo-inline-cliente", p?.cliente_id],
    enabled: !!p?.cliente_id,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", p!.cliente_id as string)
        .maybeSingle();
      return data as { nome: string } | null;
    },
  });

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-6 px-1 text-xs"
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
        Detalhar
      </Button>

      {aberto && (
        <div className="rounded-md border border-border bg-background/60 p-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando resumo do processo...
            </div>
          )}
          {!isLoading && !p && (
            <p className="text-xs text-muted-foreground">Resumo não disponível.</p>
          )}
          {!isLoading && p && (
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              <Campo label="Polo ativo" valor={txt(p.polo_ativo) || txt(p.reclamante) || txt(p.autor)} />
              <Campo label="Polo passivo" valor={txt(p.polo_passivo) || txt(p.reclamados) || txt(p.requerido)} />
              <Campo label="Terceiro envolvido" valor={txt(p.terceiro_envolvido)} />
              <Campo label="Cliente" valor={txt(cliente?.nome)} />
              <Campo label="Valor da causa" valor={fmtMoeda(p.valor_causa)} />
              <Campo label="Valor da condenação" valor={fmtMoeda(p.valor_condenacao)} />
              <Campo label="Valor provisionado" valor={fmtMoeda(p.valor_provisionado)} />
              <Campo label="Tribunal" valor={txt(p.tribunal)} />
              <Campo label="Vara" valor={txt(p.vara)} />
              <Campo label="Órgão julgador" valor={txt(p.orgao_julgador)} />
              <Campo label="Comarca" valor={[txt(p.comarca), txt(p.uf)].filter(Boolean).join(" / ") || null} />
              <Campo label="Status" valor={txt(p.status)?.replace(/_/g, " ") || null} />
              <Campo label="Fase" valor={txt(p.fase)} />
              <Campo label="Área" valor={txt(p.area)} />
              <Campo label="Matéria" valor={txt(p.materia)} />
              <Campo label="Tipo do processo" valor={txt(p.tipo_processo)} />
              <Campo label="Distribuição" valor={fmtData(p.data_distribuicao)} />
              <Campo label="Data fatal" valor={fmtData(p.data_fatal)} />
              <div className="sm:col-span-2">
                <Campo label="Objeto da ação" valor={txt(p.objeto)} />
              </div>
              <div className="sm:col-span-2">
                <Campo label="Pedidos" valor={txt(p.pedidos)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
