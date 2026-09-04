import { useQuery } from "@tanstack/react-query";
import { Loader2, Scale, Building2, Users, Wallet, CalendarDays, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  "instancia",
  "sistema",
  "status",
  "fase",
  "area",
  "materia",
  "tipo_processo",
  "data_distribuicao",
  "data_fatal",
  "objeto",
  "pedidos",
  "assunto",
  "descricao",
  "pasta_fisica",
  "pasta_cliente",
  "segredo_justica",
  "acompanhamento_especial",
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
    const j = v
      .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
      .filter(Boolean)
      .join(", ");
    return j.trim() || null;
  }
  const s = String(v).trim();
  return s ? s : null;
}

function Campo({
  label,
  valor,
  full,
  mono,
}: {
  label: string;
  valor: string | null;
  full?: boolean;
  mono?: boolean;
}) {
  if (!valor) return null;
  return (
    <div className={cn("min-w-0", full && "sm:col-span-2")}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-[13px] leading-snug text-foreground break-words whitespace-pre-wrap",
          mono && "font-mono",
        )}
      >
        {valor}
      </p>
    </div>
  );
}

function Secao({
  titulo,
  icon: Icon,
  children,
}: {
  titulo: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-card">
      <header className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold text-foreground">{titulo}</h4>
      </header>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 p-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

interface Props {
  processoId: string;
}

/** Resumo completo do processo, em blocos legíveis, para o painel lateral. */
export function ProcessoLateralResumo({ processoId }: Props) {
  const { data: p, isLoading } = useQuery({
    queryKey: ["processo-lateral-resumo", processoId],
    enabled: !!processoId,
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
    queryKey: ["processo-lateral-resumo-cliente", p?.cliente_id],
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

  const { data: responsaveis = [] } = useQuery({
    queryKey: ["processo-lateral-resumo-responsaveis", processoId],
    enabled: !!processoId,
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("processos_responsaveis")
        .select("user_id")
        .eq("processo_id", processoId);
      const ids = ((data as any[]) || []).map((r) => r.user_id).filter(Boolean);
      if (!ids.length) return [] as string[];
      const { data: perfis } = await (supabase as any)
        .from("profiles_basic")
        .select("id, nome")
        .in("id", ids);
      return ((perfis as any[]) || []).map((x) => x.nome).filter(Boolean) as string[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando resumo do processo...
      </div>
    );
  }

  if (!p) {
    return <p className="p-4 text-xs text-muted-foreground">Resumo não disponível.</p>;
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {txt(p.status) && (
          <Badge variant="secondary" className="capitalize">
            {txt(p.status)!.replace(/_/g, " ")}
          </Badge>
        )}
        {txt(p.area) && <Badge variant="outline" className="capitalize">{txt(p.area)}</Badge>}
        {txt(p.instancia) && <Badge variant="outline">{txt(p.instancia)}</Badge>}
        {p.acompanhamento_especial && <Badge className="bg-amber-500 text-white">Acompanhamento especial</Badge>}
        {p.segredo_justica && <Badge variant="outline">Segredo de justiça</Badge>}
      </div>

      <Secao titulo="Partes e cliente" icon={Users}>
        <Campo
          label="Polo ativo"
          valor={txt(p.polo_ativo) || txt(p.reclamante) || txt(p.autor)}
        />
        <Campo
          label="Polo passivo"
          valor={txt(p.polo_passivo) || txt(p.reclamados) || txt(p.requerido)}
        />
        <Campo label="Terceiro envolvido" valor={txt(p.terceiro_envolvido)} />
        <Campo label="Cliente" valor={txt(cliente?.nome)} />
        <Campo label="Responsáveis" valor={responsaveis.length ? responsaveis.join(", ") : null} full />
      </Secao>

      <Secao titulo="Órgão e tramitação" icon={Building2}>
        <Campo label="Tribunal" valor={txt(p.tribunal)} />
        <Campo label="Vara" valor={txt(p.vara)} />
        <Campo label="Órgão julgador" valor={txt(p.orgao_julgador)} />
        <Campo
          label="Comarca / UF"
          valor={[txt(p.comarca), txt(p.uf)].filter(Boolean).join(" / ") || null}
        />
        <Campo label="Sistema" valor={txt(p.sistema)} />
        <Campo label="Fase" valor={txt(p.fase)} />
        <Campo label="Matéria" valor={txt(p.materia)} />
        <Campo label="Tipo do processo" valor={txt(p.tipo_processo)} />
      </Secao>

      <Secao titulo="Datas" icon={CalendarDays}>
        <Campo label="Distribuição" valor={fmtData(p.data_distribuicao)} />
        <Campo label="Data fatal" valor={fmtData(p.data_fatal)} />
      </Secao>

      <Secao titulo="Valores" icon={Wallet}>
        <Campo label="Valor da causa" valor={fmtMoeda(p.valor_causa)} />
        <Campo label="Valor da condenação" valor={fmtMoeda(p.valor_condenacao)} />
        <Campo label="Valor provisionado" valor={fmtMoeda(p.valor_provisionado)} />
      </Secao>

      <Secao titulo="Objeto e pedidos" icon={Scale}>
        <Campo label="Assunto" valor={txt(p.assunto)} full />
        <Campo label="Objeto da ação" valor={txt(p.objeto)} full />
        <Campo label="Pedidos" valor={txt(p.pedidos)} full />
      </Secao>

      <Secao titulo="Pastas e observações" icon={FileText}>
        <Campo label="Pasta física" valor={txt(p.pasta_fisica)} />
        <Campo label="Pasta do cliente" valor={txt(p.pasta_cliente)} />
        <Campo label="Descrição" valor={txt(p.descricao)} full />
      </Secao>
    </div>
  );
}
