/**
 * Janela lateral (direita, sobreposta) que compara as fichas duplicadas de um
 * mesmo processo lado a lado, destacando os campos com valores diferentes.
 *
 * Somente leitura + ações já existentes (abrir a ficha / arquivar). Nada é
 * excluído: "Arquivar" usa a mesma rotina de arquivamento da tela.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ExternalLink, Archive } from "lucide-react";
import { useProcessoTagsCatalogo } from "@/hooks/useProcessoTags";
import { cn } from "@/lib/utils";

const STATUS_CONCLUIDOS = ["pronto_envio", "planilhado", "enviado"];

const STATUS_LABEL: Record<string, string> = {
  pronto_envio: "Pronto para enviar",
  planilhado: "Planilhado na carga",
  enviado: "Enviado ao Benner",
  pendente: "Pendente",
};

function fmtDataHoraBRT(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function fmtData(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function fmtBool(v: any): string {
  if (v === true) return "Sim";
  if (v === false) return "Não";
  return "—";
}

function fmtLista(v: any): string {
  if (!v) return "—";
  if (Array.isArray(v)) {
    const itens = v
      .map((i) => (i && typeof i === "object" ? i.materia || i.nome || i.descricao || i.tema || "" : String(i ?? "")))
      .map((s) => String(s).trim())
      .filter(Boolean);
    return itens.length ? itens.join(" • ") : "—";
  }
  const s = String(v).trim();
  return s || "—";
}

function fmtTexto(v: any): string {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || "—";
}

interface Campo {
  label: string;
  valor: (row: any) => string;
}

const CAMPOS: Campo[] = [
  { label: "Dossiê", valor: (r) => fmtTexto(r.dossie) },
  { label: "Aba de origem", valor: (r) => fmtTexto(r.aba_origem) },
  { label: "Fonte de importação", valor: (r) => fmtTexto(r.fonte_importacao) },
  { label: "Situação do trabalho", valor: (r) => STATUS_LABEL[String(r.status || "")] || fmtTexto(r.status) },
  { label: "Situação do processo", valor: (r) => fmtTexto(r.situacao_processo) },
  { label: "Turma", valor: (r) => fmtTexto(r.turma) },
  { label: "Relator", valor: (r) => fmtTexto(r.relator) },
  { label: "Data distribuição (planilha)", valor: (r) => fmtData(r.data_distribuicao_planilha) },
  { label: "Data distribuição (real)", valor: (r) => fmtData(r.data_distribuicao_real) },
  { label: "Parte recorrente", valor: (r) => fmtTexto(r.parte_recorrente || r.recorrente) },
  { label: "Tipo de recurso", valor: (r) => fmtLista(r.tipo_recurso) },
  { label: "Matérias (reclamante)", valor: (r) => fmtLista(r.materias_analise_reclamante) },
  { label: "Matérias (banco)", valor: (r) => fmtLista(r.materias_analise_banco) },
  { label: "Tem matérias do dossiê", valor: (r) => fmtBool(r.tem_materias_dossie) },
  { label: "Judit preenchido", valor: (r) => fmtBool(r.judit_preenchido) },
  { label: "Problema Judit", valor: (r) => fmtBool(r.problema_judit) },
  { label: "Benner atualizado", valor: (r) => fmtBool(r.benner_atualizado) },
  { label: "Trânsito em julgado", valor: (r) => fmtBool(r.transito_julgado) },
  { label: "Acordo", valor: (r) => fmtBool(r.acordo) },
  { label: "Outro escritório", valor: (r) => fmtBool(r.processo_outro_escritorio) },
  { label: "Segredo de justiça", valor: (r) => fmtBool(r.segredo_justica) },
  { label: "CEJUSC", valor: (r) => fmtBool(r.cejusc) },
  { label: "Recurso de terceiro", valor: (r) => fmtBool(r.recurso_terceiro) },
  { label: "Equipe", valor: (r) => fmtTexto(r.equipe) },
  { label: "Criada em (BRT)", valor: (r) => fmtDataHoraBRT(r.created_at) },
  { label: "Última alteração (BRT)", valor: (r) => fmtDataHoraBRT(r.updated_at) },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Número do processo em análise (apenas exibição). */
  processo?: string | null;
  /** IDs das fichas duplicadas do grupo. */
  ids: string[];
  /** Abre a ficha escolhida no formulário. */
  onAbrirFicha?: (id: string) => void;
  /** Arquiva a ficha escolhida (não exclui). */
  onArquivarFicha?: (id: string) => void;
  podeArquivar?: boolean;
}

export function DuplicadosCompararSheet({
  open,
  onOpenChange,
  processo,
  ids,
  onAbrirFicha,
  onArquivarFicha,
  podeArquivar,
}: Props) {
  const idsKey = useMemo(() => [...ids].sort().join(","), [ids]);
  const { data: catalogo = [] } = useProcessoTagsCatalogo();

  const { data, isLoading } = useQuery({
    queryKey: ["duplicados-comparar", idsKey],
    enabled: open && ids.length > 0,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("dados_benner" as any)
        .select("*")
        .in("id", ids);
      if (error) throw error;

      const [tagsRes, respRes] = await Promise.all([
        supabase.from("dados_benner_processo_tags" as any).select("dado_benner_id, tag_id").in("dado_benner_id", ids),
        supabase.from("dados_benner_responsaveis" as any).select("dados_benner_id, usuario_id").in("dados_benner_id", ids),
      ]);

      const tagsPorFicha = new Map<string, string[]>();
      for (const t of ((tagsRes.data as any[]) || [])) {
        const arr = tagsPorFicha.get(t.dado_benner_id) || [];
        arr.push(t.tag_id);
        tagsPorFicha.set(t.dado_benner_id, arr);
      }

      const usuarioIds = Array.from(new Set(((respRes.data as any[]) || []).map((r) => r.usuario_id).filter(Boolean)));
      const nomes = new Map<string, string>();
      if (usuarioIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles_basic" as any)
          .select("id, nome")
          .in("id", usuarioIds);
        for (const p of ((profs as any[]) || [])) nomes.set(p.id, p.nome || "—");
      }
      const respPorFicha = new Map<string, string[]>();
      for (const r of ((respRes.data as any[]) || [])) {
        const arr = respPorFicha.get(r.dados_benner_id) || [];
        arr.push(nomes.get(r.usuario_id) || "—");
        respPorFicha.set(r.dados_benner_id, arr);
      }

      const ordenadas = ((rows as any[]) || []).sort((a, b) =>
        String(a.created_at || "").localeCompare(String(b.created_at || "")),
      );
      return { fichas: ordenadas, tagsPorFicha, respPorFicha };
    },
  });

  const fichas = data?.fichas || [];
  const nomeTag = (id: string) => catalogo.find((t) => t.id === id)?.nome || "TAG";

  const linhas = useMemo(() => {
    if (fichas.length === 0) return [];
    const base = CAMPOS.map((c) => ({
      label: c.label,
      valores: fichas.map((f) => c.valor(f)),
    }));
    // Responsáveis e TAGs entram como linhas próprias.
    base.splice(3, 0, {
      label: "Responsáveis",
      valores: fichas.map((f) => (data?.respPorFicha.get(f.id) || []).join(", ") || "—"),
    });
    base.push({
      label: "TAGs",
      valores: fichas.map((f) => (data?.tagsPorFicha.get(f.id) || []).map(nomeTag).sort().join(", ") || "—"),
    });
    return base.map((l) => ({
      ...l,
      divergente: new Set(l.valores).size > 1,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichas, data, catalogo]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[min(96vw,1100px)] overflow-y-auto">
        <SheetHeader className="mb-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Processo duplicado
          </SheetTitle>
          <SheetDescription className="text-xs">
            {fichas.length > 0
              ? `${fichas.length} fichas com o processo ${processo || "—"}. Os campos com diferença estão destacados.`
              : `Processo ${processo || "—"}`}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : fichas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma ficha duplicada encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 w-44 sticky left-0 bg-background">Campo</th>
                  {fichas.map((f, i) => {
                    const concluida = STATUS_CONCLUIDOS.includes(String(f.status || ""));
                    return (
                      <th key={f.id} className="text-left p-2 align-top min-w-[220px] border-l">
                        <div className="space-y-1">
                          <div className="font-semibold">Ficha {i + 1}</div>
                          {concluida && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1 py-0 h-4">
                              Concluída — não descartar
                            </Badge>
                          )}
                          <div className="flex flex-wrap gap-1 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[11px] px-2"
                              onClick={() => onAbrirFicha?.(f.id)}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                            </Button>
                            {podeArquivar && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[11px] px-2 text-amber-700 border-amber-300"
                                onClick={() => onArquivarFicha?.(f.id)}
                                title="Arquiva esta ficha (não exclui)"
                              >
                                <Archive className="w-3 h-3 mr-1" /> Arquivar
                              </Button>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr
                    key={l.label}
                    className={cn(
                      "border-t",
                      l.divergente && "bg-red-50/70 dark:bg-red-950/20",
                    )}
                  >
                    <td className="p-2 font-medium text-muted-foreground sticky left-0 bg-inherit">{l.label}</td>
                    {l.valores.map((v, i) => (
                      <td
                        key={i}
                        className={cn("p-2 align-top border-l break-words", l.divergente && "text-destructive font-medium")}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
