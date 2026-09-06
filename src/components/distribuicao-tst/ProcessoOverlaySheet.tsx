import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemDrawer } from "@/components/agenda/ItemDrawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { obterVariantesCnjBusca } from "@/utils/cnjMask";
import {
  Loader2,
  Search,
  ExternalLink,
  Scale,
  Gavel,
  FileText,
  Users,
  CalendarDays,
  Landmark,
  AlertTriangle,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

/* ─────────────── helpers ─────────────── */

function fmtData(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
function fmtDataHora(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR");
}
function fmtMoeda(v: any): string {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  if (!isFinite(n) || isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function txt(v: any): string {
  if (Array.isArray(v)) {
    const itens = v
      .map((i) => (i && typeof i === "object" ? i.materia || i.nome || i.descricao || i.tema || "" : String(i ?? "")))
      .map((s) => String(s).trim())
      .filter(Boolean);
    return itens.length ? itens.join(", ") : "—";
  }
  const s = v === null || v === undefined ? "" : String(v).trim();
  if (!s || /^n[ãa]o informado$/i.test(s)) return "—";
  return s;
}


/** Booleano do banco → "Sim"/"Não"/"—" (leitura). */
function sn(v: any): string {
  if (v === null || v === undefined) return "—";
  return v ? "Sim" : "Não";
}

/** Renderiza a lista JSONB "Análise por matéria" (Reclamante/Banco) em leitura. */
function MateriasAnalise({ titulo, lista }: { titulo: string; lista: any }) {
  const itens: any[] = Array.isArray(lista) ? lista : [];
  if (!itens.length) return null;
  return (
    <div className="mt-2 rounded-md border bg-muted/30 p-2.5">
      <div className="mb-1.5 text-xs font-semibold text-foreground">{titulo}</div>
      <ul className="space-y-1.5">
        {itens.map((m, i) => {
          const nome = m?.materia || m?.nome || m?.descricao || m?.tema || `Matéria ${i + 1}`;
          const detalhes = [
            m?.aparelhamento ? `Aparelhamento: ${m.aparelhamento}` : null,
            m?.chance_exito || m?.chanceExito ? `Chance: ${m.chance_exito || m.chanceExito}` : null,
            m?.relator ? `Relator: ${m.relator}` : null,
            m?.turma ? `Turma: ${m.turma}` : null,
          ].filter(Boolean).join(" · ");
          return (
            <li key={i} className="text-xs text-foreground">
              <span className="font-medium">{nome}</span>
              {detalhes && <span className="text-muted-foreground"> — {detalhes}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Classifica a movimentação para o advogado enxergar o que importa. */
type Categoria = {
  key: string;
  label: string;
  className: string;
  destaque: boolean;
};
const CATEGORIAS: { key: string; label: string; re: RegExp; className: string; destaque: boolean }[] = [
  { key: "transito", label: "Trânsito em julgado", re: /trânsito|transitad/i, className: "bg-orange-600 text-white", destaque: true },
  { key: "julgamento", label: "Julgamento / Decisão", re: /julgad|julgamento|ac[óo]rd[ãa]o|decis[ãa]o|senten[çc]a|provi(do|mento)|negad|denegad|homologa/i, className: "bg-emerald-600 text-white", destaque: true },
  { key: "pauta", label: "Pauta / Sessão", re: /pauta|sess[ãa]o|inclu[íi]d[oa] em/i, className: "bg-blue-600 text-white", destaque: true },
  { key: "recurso", label: "Recurso", re: /recurso|agravo|embargos|revista|extraordin[áa]rio|contrarraz/i, className: "bg-indigo-600 text-white", destaque: true },
  { key: "prazo", label: "Prazo / Intimação", re: /intima[çc]|prazo|not[ií]fica|cita[çc]/i, className: "bg-amber-500 text-white", destaque: false },
  { key: "publicacao", label: "Publicação", re: /publicad|disponibilizad|di[áa]rio/i, className: "bg-sky-600 text-white", destaque: false },
  { key: "distribuicao", label: "Distribuição", re: /distribu/i, className: "bg-violet-600 text-white", destaque: false },
  { key: "conclusao", label: "Conclusão / Remessa", re: /conclus[ãa]o|remetid|remessa|recebid/i, className: "bg-slate-500 text-white", destaque: false },
  { key: "arquivo", label: "Arquivamento / Baixa", re: /arquiv|baixa definitiva|baixado/i, className: "bg-stone-600 text-white", destaque: false },
];
function classificar(conteudo: string): Categoria | null {
  for (const c of CATEGORIAS) if (c.re.test(conteudo)) return c;
  return null;
}

type Movimento = {
  id: string;
  data: string | null;
  conteudo: string;
  instancia?: number | null;
  fonte?: string | null;
  categoria: Categoria | null;
};

type Lawsuit = Record<string, any>;

/** Reúne os objetos de processo devolvidos pela Judit em qualquer formato. */
function coletarLawsuits(raw: any): Lawsuit[] {
  const out: Lawsuit[] = [];
  const visto = new Set<any>();
  const walk = (node: any, depth: number) => {
    if (!node || typeof node !== "object" || depth > 12 || visto.has(node)) return;
    visto.add(node);
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, depth + 1));
      return;
    }
    const pareceProcesso =
      ("steps" in node && Array.isArray(node.steps)) || ("code" in node && ("phase" in node || "parties" in node));
    if (pareceProcesso) out.push(node);
    // percorre todos os ramos (o payload real vem em _judit_raw.crawler.page_data[].response_data)
    Object.keys(node).forEach((k) => {
      const v = node[k];
      if (v && typeof v === "object") walk(v, depth + 1);
    });
  };

  walk(raw, 0);
  return out;
}

function extrairMovimentos(lawsuits: Lawsuit[]): Movimento[] {
  const porId = new Map<string, Movimento>();
  lawsuits.forEach((l) => {
    const steps: any[] = Array.isArray(l?.steps) ? l.steps : [];
    steps.forEach((s, i) => {
      const conteudo = String(s?.content ?? s?.descricao ?? s?.description ?? "").replace(/\s*\n\s*/g, " ").trim();
      if (!conteudo) return;
      const data = s?.step_date ?? s?.date ?? null;
      const id = String(s?.step_id ?? `${data ?? ""}-${conteudo.slice(0, 40)}-${i}`);
      if (porId.has(id)) return;
      porId.set(id, {
        id,
        data,
        conteudo,
        instancia: s?.lawsuit_instance ?? null,
        fonte: s?.source_name ?? null,
        categoria: classificar(conteudo),
      });
    });
  });
  return [...porId.values()].sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());
}

/* ─────────────── blocos de UI ─────────────── */

function Campo({ rotulo, valor, className }: { rotulo: string; valor: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className="text-sm text-foreground break-words">{valor}</div>
    </div>
  );
}

function Bloco({
  titulo,
  icone: Icone,
  acao,
  children,
}: {
  titulo: string;
  icone?: any;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground/80">
          {Icone && <Icone className="h-3.5 w-3.5 text-primary" />}
          {titulo}
        </h4>
        {acao}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function BlocoRecurso({
  titulo,
  tipo,
  materias,
  aparelhamento,
  chance,
}: {
  titulo: string;
  tipo?: string | null;
  materias?: string | null;
  aparelhamento?: string | null;
  chance?: string | null;
}) {
  if (!tipo && !materias && !aparelhamento && !chance) return null;
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="mb-1.5 text-xs font-semibold text-foreground">{titulo}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Campo rotulo="Tipo de recurso" valor={txt(tipo)} />
        <Campo rotulo="Aparelhamento" valor={txt(aparelhamento)} />
        <Campo rotulo="Chance de êxito" valor={txt(chance)} />
        <Campo rotulo="Matérias" valor={txt(materias)} className="col-span-2" />
      </div>
    </div>
  );
}

function ListaPartes({ partes }: { partes: any[] }) {
  if (!partes.length) return <p className="text-sm italic text-muted-foreground">Nenhuma parte retornada.</p>;
  return (
    <div className="space-y-2">
      {partes.map((p, i) => {
        const advs: any[] = Array.isArray(p?.lawyers) ? p.lawyers : [];
        return (
          <div key={i} className="rounded-md border bg-muted/30 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-sm font-semibold">{txt(p?.name)}</span>
              <span className="flex flex-wrap gap-1">
                {p?.side && <Badge variant="secondary" className="text-[10px]">{String(p.side)}</Badge>}
                {p?.person_type && <Badge variant="outline" className="text-[10px]">{String(p.person_type)}</Badge>}
              </span>
            </div>
            {p?.main_document && (
              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{String(p.main_document)}</div>
            )}
            {advs.length > 0 && (
              <div className="mt-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Advogados ({advs.length})
                </div>
                <ul className="mt-0.5 space-y-0.5 text-xs">
                  {advs.map((a, j) => (
                    <li key={j} className="break-words">
                      {txt(a?.name)}
                      {a?.license_number || a?.oab ? ` — OAB ${a.license_number || a.oab}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── componente principal ─────────────── */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro: any | null;
  responsaveis?: { nome: string }[];
  tagsSlot?: React.ReactNode;
  onAbrirFicha?: () => void;
}

export function ProcessoOverlaySheet({ open, onOpenChange, registro, responsaveis = [], tagsSlot, onAbrirFicha }: Props) {
  const [aba, setAba] = useState("resumo");
  const [buscaMov, setBuscaMov] = useState("");
  const [somenteRelevantes, setSomenteRelevantes] = useState(false);

  const processoNumero = registro?.processo_numero || registro?.processo || "";

  const { data: log, isLoading } = useQuery({
    queryKey: ["dist-tst-overlay-judit", processoNumero],
    enabled: open && !!processoNumero,
    staleTime: 60_000,
    queryFn: async () => {
      const variantes = obterVariantesCnjBusca(processoNumero);
      const { data, error } = await supabase
        .from("judit_logs" as any)
        .select("id, created_at, status, error_message, raw_response")
        .in("processo_numero", variantes)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data as any[]) || [])[0] || null;
    },
  });

  // Linha completa de dados_benner: a lista traz só os campos mapeados, e a
  // aba "Distribuição TST" precisa de todos (resultado_*, notas, julgamento…).
  const { data: rowCompleto } = useQuery({
    queryKey: ["dist-tst-overlay-row", registro?.id],
    enabled: open && !!registro?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dados_benner" as any)
        .select("*")
        .eq("id", registro!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const ficha: any = rowCompleto || registro || {};

  const lawsuits = useMemo(() => coletarLawsuits(log?.raw_response), [log]);
  const principal: Lawsuit = useMemo(() => {
    if (!lawsuits.length) return {};
    return [...lawsuits].sort(
      (a, b) => (Array.isArray(b?.steps) ? b.steps.length : 0) - (Array.isArray(a?.steps) ? a.steps.length : 0),
    )[0];
  }, [lawsuits]);
  const movimentos = useMemo(() => extrairMovimentos(lawsuits), [lawsuits]);

  const movimentosFiltrados = useMemo(() => {
    const termo = buscaMov.trim().toLowerCase();
    return movimentos.filter((m) => {
      if (somenteRelevantes && !m.categoria?.destaque) return false;
      if (termo && !m.conteudo.toLowerCase().includes(termo) && !(m.categoria?.label.toLowerCase().includes(termo))) return false;
      return true;
    });
  }, [movimentos, buscaMov, somenteRelevantes]);

  const partes: any[] = Array.isArray(principal?.parties) ? principal.parties : [];
  const assuntos: any[] = Array.isArray(principal?.subjects) ? principal.subjects : [];
  const orgaos: any[] = Array.isArray(principal?.courts) ? principal.courts : [];
  const classificacoes: any[] = Array.isArray(principal?.classifications) ? principal.classifications : [];
  const relacionados: any[] = Array.isArray(principal?.related_lawsuits) ? principal.related_lawsuits : [];
  const fases: any[] = Array.isArray(principal?.phase_history) ? principal.phase_history : [];

  const dataDistribuicao = registro?.data_distribuicao_real || registro?.data_distribuicao_planilha;

  if (!registro) return null;

  return (
    <ItemDrawer
      open={open}
      onOpenChange={onOpenChange}
      titulo={`Dossiê ${txt(registro.dossie)}`}
      subtitulo={processoNumero || null}
      className="lg:w-[860px] sm:w-[min(860px,96vw)]"
    >
      <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <TabsList className="h-8">
            <TabsTrigger value="resumo" className="h-6 px-3 text-xs">Resumo do processo</TabsTrigger>
            <TabsTrigger value="movimentacoes" className="h-6 px-3 text-xs">
              Movimentações {movimentos.length > 0 && <span className="ml-1 text-muted-foreground">({movimentos.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="judit" className="h-6 px-3 text-xs">Dados da Judit</TabsTrigger>
            <TabsTrigger value="ficha" className="h-6 px-3 text-xs">Distribuição TST</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1.5">
            {processoNumero && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(processoNumero);
                  toast.success("Número do processo copiado");
                }}
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Copiar nº
              </Button>
            )}
            {onAbrirFicha && (
              <Button size="sm" className="h-7 px-2 text-xs" onClick={onAbrirFicha}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir ficha completa
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {/* ─── Resumo ─── */}
          <TabsContent value="resumo" className="mt-0 space-y-3">
            <Bloco titulo="Identificação" icone={FileText}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <Campo rotulo="Processo" valor={<span className="font-mono text-xs">{txt(processoNumero)}</span>} />
                <Campo rotulo="Dossiê" valor={txt(registro.dossie)} />
                <Campo rotulo="Tribunal" valor={txt(registro.tribunal)} />
                <Campo rotulo="Distribuição" valor={fmtData(dataDistribuicao)} />
                <Campo rotulo="Origem (aba)" valor={txt(registro.aba_origem)} />
                <Campo rotulo="Equipe" valor={txt(registro.equipe)} />
                <Campo rotulo="Situação do processo" valor={txt(registro.situacao_processo)} />
                <Campo rotulo="Turma" valor={txt(registro.turma)} />
                <Campo rotulo="Relator" valor={txt(registro.relator)} />
              </div>
              {(registro.turma_favorabilidade || registro.relator_favorabilidade) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {registro.relator_favorabilidade && (
                    <Badge variant="outline" className="text-[10px]">Relator: {registro.relator_favorabilidade}</Badge>
                  )}
                  {registro.turma_favorabilidade && (
                    <Badge variant="outline" className="text-[10px]">Turma: {registro.turma_favorabilidade}</Badge>
                  )}
                </div>
              )}
            </Bloco>

            <Bloco titulo="Partes e responsáveis" icone={Users}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Campo rotulo="Reclamante" valor={txt(registro.reclamante)} />
                <Campo rotulo="Reclamada" valor={txt(registro.reclamada)} />
                <Campo rotulo="Parte recorrente" valor={txt(registro.parte_recorrente || registro.recorrente)} />
                <Campo
                  rotulo="Responsáveis"
                  valor={responsaveis.length ? responsaveis.map((r) => r.nome).join(", ") : "—"}
                />
              </div>
            </Bloco>

            <Bloco titulo="Recursos e matérias" icone={Scale}>
              <div className="space-y-2">
                <BlocoRecurso
                  titulo="Reclamante"
                  tipo={registro.tipo_recurso_reclamante}
                  materias={registro.materias_recurso_reclamante}
                  aparelhamento={registro.aparelhamento_reclamante}
                  chance={registro.chance_exito_reclamante}
                />
                <BlocoRecurso
                  titulo="Banco / Reclamada"
                  tipo={registro.tipo_recurso_banco}
                  materias={registro.materias_recurso_banco}
                  aparelhamento={registro.aparelhamento_banco}
                  chance={registro.chance_exito_banco}
                />
                <BlocoRecurso
                  titulo="Terceiro"
                  tipo={registro.tipo_recurso_terceiro}
                  materias={registro.materias_recurso_terceiro}
                  aparelhamento={registro.aparelhamento_terceiro}
                  chance={registro.chance_exito_terceiro}
                />
                {!registro.tipo_recurso_reclamante &&
                  !registro.tipo_recurso_banco &&
                  !registro.tipo_recurso_terceiro && (
                    <p className="text-sm italic text-muted-foreground">Nenhum recurso cadastrado.</p>
                  )}
              </div>
            </Bloco>

            <Bloco titulo="Marcadores e situação" icone={CheckCircle2} acao={tagsSlot ? undefined : undefined}>
              <div className="flex flex-wrap gap-1.5">
                {registro.status && <Badge className="text-[10px]">{String(registro.status).replace(/_/g, " ")}</Badge>}
                {registro.em_analise && <Badge variant="outline" className="text-[10px]">Em análise</Badge>}
                {registro.transito_julgado && <Badge className="bg-orange-500 text-[10px] text-white hover:bg-orange-500">Trânsito em julgado</Badge>}
                {registro.cejusc && <Badge className="bg-teal-600 text-[10px] text-white hover:bg-teal-600">CEJUSC</Badge>}
                {registro.subida_em_massa && <Badge className="bg-purple-600 text-[10px] text-white hover:bg-purple-600">Subida em massa</Badge>}
                {registro.segredo_justica && <Badge className="bg-rose-600 text-[10px] text-white hover:bg-rose-600">Segredo de justiça</Badge>}
                {registro.processo_outro_escritorio && <Badge className="bg-violet-600 text-[10px] text-white hover:bg-violet-600">Outro escritório</Badge>}
                {registro.ic_duplicado && <Badge variant="destructive" className="text-[10px]">Duplicado</Badge>}
                {registro.ic_arquivado && <Badge variant="outline" className="text-[10px]">Arquivado</Badge>}
                {String(registro.provas_digitais || "").trim().toLowerCase() === "s" && (
                  <Badge className="bg-blue-600 text-[10px] text-white hover:bg-blue-600">Provas digitais</Badge>
                )}
                {registro.problema_judit && <Badge className="bg-amber-500 text-[10px] text-white hover:bg-amber-500">Problema Judit</Badge>}
              </div>
              {tagsSlot && (
                <>
                  <Separator className="my-2.5" />
                  <div className="flex flex-wrap items-center gap-1">{tagsSlot}</div>
                </>
              )}
              {registro.observacao_advogado && (
                <>
                  <Separator className="my-2.5" />
                  <Campo rotulo="Observação do advogado" valor={String(registro.observacao_advogado)} />
                </>
              )}
            </Bloco>
          </TabsContent>

          {/* ─── Movimentações ─── */}
          <TabsContent value="movimentacoes" className="mt-0 space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando movimentações da Judit…
              </div>
            ) : movimentos.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Nenhuma movimentação da Judit disponível para este processo. Faça uma consulta Judit na ficha do processo.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border bg-card p-2 text-center">
                    <div className="text-lg font-bold leading-none">{movimentos.length}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Movimentos</div>
                  </div>
                  <div className="rounded-md border bg-card p-2 text-center">
                    <div className="text-sm font-bold leading-tight">{fmtData(movimentos[0]?.data)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Último movimento</div>
                  </div>
                  <div className="rounded-md border bg-card p-2 text-center">
                    <div className="text-lg font-bold leading-none">
                      {movimentos.filter((m) => m.categoria?.destaque).length}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Relevantes</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={buscaMov}
                      onChange={(e) => setBuscaMov(e.target.value)}
                      placeholder="Buscar na movimentação…"
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                  <Button
                    variant={somenteRelevantes ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSomenteRelevantes((v) => !v)}
                  >
                    <Gavel className="mr-1 h-3.5 w-3.5" /> Só o que importa
                  </Button>
                </div>

                <ol className="space-y-2">
                  {movimentosFiltrados.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-md border-l-2 bg-card p-2.5 shadow-sm ${
                        m.categoria?.destaque ? "border-l-primary" : "border-l-border"
                      } border border-l-2`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {fmtDataHora(m.data)}
                        </span>
                        {m.categoria && (
                          <Badge className={`text-[10px] ${m.categoria.className} hover:${m.categoria.className}`}>
                            {m.categoria.label}
                          </Badge>
                        )}
                        {m.instancia ? (
                          <Badge variant="outline" className="text-[10px]">{m.instancia}ª instância</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-snug text-foreground">{m.conteudo}</p>
                    </li>
                  ))}
                  {movimentosFiltrados.length === 0 && (
                    <li className="py-6 text-center text-sm italic text-muted-foreground">
                      Nenhuma movimentação encontrada com esse filtro.
                    </li>
                  )}
                </ol>
              </>
            )}
          </TabsContent>

          {/* ─── Dados da Judit ─── */}
          <TabsContent value="judit" className="mt-0 space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados da Judit…
              </div>
            ) : !log ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Nenhuma consulta Judit registrada para este processo.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={log.status === "sucesso" ? "outline" : "destructive"} className="text-[10px]">
                    {String(log.status || "—")}
                  </Badge>
                  Consulta de {fmtDataHora(log.created_at)}
                </div>
                {log.error_message && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    {String(log.error_message)}
                  </div>
                )}

                <Bloco titulo="Situação atual no tribunal" icone={Landmark}>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    <Campo rotulo="Fase" valor={txt(principal?.phase)} />
                    <Campo rotulo="Situação" valor={txt(principal?.situation)} />
                    <Campo rotulo="Status" valor={txt(principal?.status)} />
                    <Campo rotulo="Instância" valor={txt(principal?.instance)} />
                    <Campo rotulo="Tribunal" valor={txt(principal?.tribunal_acronym || principal?.tribunal)} />
                    <Campo rotulo="Vara / Órgão" valor={txt(principal?.county)} />
                    <Campo rotulo="Comarca" valor={txt([principal?.city, principal?.state].filter(Boolean).join(" / "))} />
                    <Campo rotulo="Juiz / Relator" valor={txt(principal?.judge)} />
                    <Campo rotulo="Valor da causa" valor={fmtMoeda(principal?.amount)} />
                    <Campo rotulo="Distribuição" valor={fmtData(principal?.distribution_date)} />
                    <Campo rotulo="Área" valor={txt(principal?.area)} />
                    <Campo rotulo="Justiça" valor={txt(principal?.justice_description || principal?.justice)} />
                    <Campo rotulo="Justiça gratuita" valor={principal?.free_justice ? "Sim" : "Não"} />
                    <Campo rotulo="Sigilo" valor={txt(principal?.secrecy_level)} />
                    <Campo rotulo="Atualizado na Judit" valor={fmtDataHora(principal?.updated_at)} />
                  </div>
                  {principal?.tribunal_url && (
                    <a
                      href={String(principal.tribunal_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir no site do tribunal
                    </a>
                  )}
                </Bloco>

                <Bloco titulo={`Partes e advogados (${partes.length})`} icone={Users}>
                  <ListaPartes partes={partes} />
                </Bloco>

                {assuntos.length > 0 && (
                  <Bloco titulo={`Assuntos (${assuntos.length})`} icone={Scale}>
                    <ul className="space-y-1 text-sm">
                      {assuntos.map((a, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>
                            {txt(a?.name)}
                            {a?.code ? <span className="ml-1 text-xs text-muted-foreground">({a.code})</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Bloco>
                )}

                {(orgaos.length > 0 || classificacoes.length > 0) && (
                  <Bloco titulo="Órgãos e classificação" icone={Landmark}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Órgãos julgadores
                        </div>
                        <ul className="mt-1 space-y-1 text-sm">
                          {orgaos.length === 0 && <li className="italic text-muted-foreground">—</li>}
                          {orgaos.map((o, i) => (
                            <li key={i}>
                              {txt(o?.name)}
                              {o?.date ? <span className="ml-1 text-xs text-muted-foreground">{fmtData(o.date)}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Classe / classificação
                        </div>
                        <ul className="mt-1 space-y-1 text-sm">
                          {classificacoes.length === 0 && <li className="italic text-muted-foreground">—</li>}
                          {classificacoes.map((c, i) => (
                            <li key={i}>
                              {txt(c?.name)}
                              {c?.code ? <span className="ml-1 text-xs text-muted-foreground">({c.code})</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Bloco>
                )}

                {fases.length > 0 && (
                  <Bloco titulo={`Histórico de fases (${fases.length})`} icone={CalendarDays}>
                    <ul className="space-y-1 text-sm">
                      {fases.map((f: any, i: number) => (
                        <li key={i} className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">{fmtData(f?.date || f?.step_date)}</span>
                          <span>{txt(f?.phase || f?.name)}</span>
                        </li>
                      ))}
                    </ul>
                  </Bloco>
                )}

                {relacionados.length > 0 && (
                  <Bloco titulo={`Processos relacionados (${relacionados.length})`} icone={FileText}>
                    <ul className="space-y-1 font-mono text-xs">
                      {relacionados.map((r: any, i: number) => (
                        <li key={i}>{typeof r === "string" ? r : txt(r?.code || r?.cnj)}</li>
                      ))}
                    </ul>
                  </Bloco>
                )}
              </>
            )}
          </TabsContent>

          {/* ─── Distribuição TST (mesmos campos do formulário, em leitura) ─── */}
          <TabsContent value="ficha" className="mt-0 space-y-3">
            <Bloco titulo="Dados Básicos" icone={FileText}>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3">
                <Campo rotulo="Data Distribuição Planilha (D)" valor={fmtData(ficha.data_distribuicao_planilha)} />
                <Campo rotulo="Data Distribuição Real (D)" valor={fmtData(ficha.data_distribuicao_real)} />
                <Campo rotulo="Número do Processo" valor={txt(ficha.processo_numero || ficha.processo)} />
                <Campo rotulo="Dossiê (A)" valor={txt(ficha.dossie)} />
                <Campo rotulo="Tribunal (B)" valor={txt(ficha.tribunal)} />
                <Campo rotulo="Equipe" valor={txt(ficha.equipe)} />
                <Campo rotulo="Reclamante" valor={txt(ficha.reclamante)} className="col-span-2 md:col-span-3" />
                <Campo rotulo="Reclamada" valor={txt(ficha.reclamada)} className="col-span-2 md:col-span-3" />
                <Campo
                  rotulo="Responsáveis"
                  valor={responsaveis.length ? responsaveis.map((r) => r.nome).join(", ") : "—"}
                  className="col-span-2 md:col-span-3"
                />
                {ficha.observacao_advogado ? (
                  <Campo rotulo="Observação Advogado" valor={txt(ficha.observacao_advogado)} className="col-span-2 md:col-span-3" />
                ) : null}
              </div>
            </Bloco>

            <Bloco titulo="Relator e Turma" icone={Gavel}>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3">
                <Campo rotulo="Relator (F)" valor={txt(ficha.relator)} />
                <Campo rotulo="Relator (+ ou -) (AD/AE)" valor={txt(ficha.relator_favorabilidade)} />
                <Campo rotulo="Turma (E)" valor={txt(ficha.turma)} />
                <Campo rotulo="Turma (+ ou -) (AB/AC)" valor={txt(ficha.turma_favorabilidade)} />
                <Campo rotulo="Parte Recorrente (AA)" valor={txt(ficha.parte_recorrente || ficha.recorrente)} />
              </div>
            </Bloco>

            <Bloco titulo="Recurso Reclamante">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Campo rotulo="Tipo de Recurso do Reclamante (C)" valor={txt(ficha.tipo_recurso_reclamante)} />
                <Campo rotulo="Tem chance de êxito?" valor={txt(ficha.tem_chance_exito_reclamante)} />
                <Campo rotulo="Matérias Recurso Reclamante" valor={txt(ficha.materias_recurso_reclamante)} className="col-span-2" />
              </div>
              <MateriasAnalise titulo="Análise por matéria (Reclamante)" lista={ficha.materias_analise_reclamante} />
            </Bloco>

            <Bloco titulo="Recurso Banco">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Campo rotulo="Tipo de Recurso do Banco (C)" valor={txt(ficha.tipo_recurso_banco)} />
                <Campo rotulo="Tem chance de êxito?" valor={txt(ficha.tem_chance_exito_banco)} />
                <Campo rotulo="Matérias Recurso do Banco" valor={txt(ficha.materias_recurso_banco)} className="col-span-2" />
              </div>
              <MateriasAnalise titulo="Análise por matéria (Banco)" lista={ficha.materias_analise_banco} />
            </Bloco>

            <Bloco titulo="Recurso de terceiro">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Campo rotulo="Tipo de Recurso (Terceiro) (C)" valor={txt(ficha.tipo_recurso_terceiro)} />
                <Campo rotulo="Aparelhamento (AF/AG)" valor={txt(ficha.aparelhamento_terceiro)} />
                <Campo rotulo="Chance de Êxito (AH)" valor={txt(ficha.chance_exito_terceiro)} />
                <Campo rotulo="Tem chance de êxito?" valor={txt(ficha.tem_chance_exito_terceiro)} />
                <Campo rotulo="Matérias Recurso (Terceiro)" valor={txt(ficha.materias_recurso_terceiro)} className="col-span-2" />
              </div>
            </Bloco>

            <Bloco titulo="Análise" icone={Scale}>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3">
                <Campo rotulo="Matéria de Honra (O)" valor={txt(ficha.honra)} />
                <Campo rotulo="Tema IRR" valor={txt(ficha.tema)} />
                <Campo rotulo="Execução" valor={txt(ficha.execucao)} />
                <Campo rotulo="Mídia Negativa (H)" valor={txt(ficha.midia_negativa)} />
                <Campo rotulo="Recurso de Terceiros" valor={txt(ficha.recurso_terceiros)} />
                <Campo rotulo="Risco — Nível" valor={txt(ficha.risco_nivel)} />
                <Campo rotulo="Risco (descrição) (I)" valor={txt(ficha.risco_descricao)} />
                <Campo rotulo="Provas Digitais (J)" valor={txt(ficha.provas_digitais)} />
                <Campo rotulo="Decisão - Análise do Quarteirizado (G)" valor={txt(ficha.decisao_quarteirizado)} className="col-span-2 md:col-span-3" />
              </div>
            </Bloco>

            <Bloco titulo="Julgamento" icone={CalendarDays}>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3">
                <Campo rotulo="Data Julgamento? (K)" valor={txt(ficha.tem_data_julgamento)} />
                <Campo rotulo="Data Julgamento (L)" valor={fmtData(ficha.data_julgamento)} />
                <Campo rotulo="Horário (M)" valor={txt(ficha.horario_julgamento)} />
                <Campo rotulo="Tipo Julgamento (N)" valor={txt(ficha.tipo_julgamento)} />
                <Campo rotulo="Entrega Memoriais (P)" valor={txt(ficha.entrega_memoriais)} />
                <Campo rotulo="Sustentação Oral (Q)" valor={txt(ficha.sustentacao_oral)} />
              </div>
            </Bloco>

            <Bloco titulo="Resultado" icone={CheckCircle2}>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4">
                <Campo rotulo="Sem Transcendência (R)" valor={sn(ficha.resultado_sem_transcendencia)} />
                <Campo rotulo="Não Conhecido (S)" valor={sn(ficha.resultado_nao_conhecido)} />
                <Campo rotulo="Conhecido e Provido (T)" valor={sn(ficha.resultado_conhecido_provido)} />
                <Campo rotulo="Conhecido e Não Provido (U)" valor={sn(ficha.resultado_conhecido_nao_provido)} />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-2">
                <Campo rotulo="Outra (descrição) (V)" valor={txt(ficha.resultado_outra)} />
                <Campo rotulo="Observações (W)" valor={txt(ficha.observacoes)} />
                <Campo rotulo="Notas" valor={txt(ficha.notas)} />
              </div>
            </Bloco>

            <Bloco titulo="Fechamento">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-3">
                <Campo rotulo="Ganhamos (X)" valor={sn(ficha.ganhamos)} />
                <Campo rotulo="Perdemos (Y)" valor={sn(ficha.perdemos)} />
                <Campo rotulo="Processo Baixado (Z)" valor={txt(ficha.processo_baixado)} />
                <Campo rotulo="Situação do Processo" valor={txt(ficha.situacao_processo)} />
                <Campo rotulo="Chance de Êxito (geral)" valor={txt(ficha.chance_exito)} />
              </div>
            </Bloco>

            <Bloco titulo="Trânsito em Julgado">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Campo rotulo="Trânsito em Julgado" valor={sn(ficha.transito_julgado)} />
                <Campo rotulo="Data Trânsito em Julgado" valor={fmtData(ficha.data_transito_julgado)} />
              </div>
            </Bloco>

            <Bloco titulo="Benner Atualizado">
              <Campo rotulo="Benner Atualizado" valor={sn(ficha.benner_atualizado)} />
            </Bloco>
          </TabsContent>
        </div>
      </Tabs>
    </ItemDrawer>
  );
}
