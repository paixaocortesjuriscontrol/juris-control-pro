/**
 * Conferência independente da exportação "Exportar Atividade" do Painel:
 * lê as tarefas/prazos direto da tabela (mesma sessão, RLS valendo) com os
 * filtros escolhidos e compara com o que foi para a planilha.
 */
export type TipoConferido = "prazo" | "tarefa" | "ata";

export interface TarefaConferencia {
  id: string;
  titulo?: string | null;
  tipo_tarefa?: string | null;
  status?: string | null;
  data_vencimento?: string | null;
  data_fatal?: string | null;
  created_at?: string | null;
  coordenacao_id?: string | null;
  responsaveis: string[];
  envolvidos: string[];
}

export interface FiltrosConferencia {
  inicio: string; // YYYY-MM-DD ("" = sem limite)
  fim: string;
  tipos: string[];
  situacoes: string[]; // valores "a|b"
  coordIds: string[];
  pessoaIds: string[];
  papeis: { responsavel: boolean; envolvido: boolean };
  referencia: "vencimento" | "cadastro";
}

const fmtBrt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
export const diaBrt = (v?: string | null): string => {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v).slice(0, 10) : fmtBrt.format(d);
};

export const classificarTarefa = (tipoTarefa?: string | null): TipoConferido | "outro" => {
  const t = (tipoTarefa ?? "").toUpperCase().trim();
  if (t === "PRAZO") return "prazo";
  if (t === "ATA") return "ata";
  if (["AUDIÊNCIA", "AUDIENCIA", "EVENTO", "PARCELAMENTO", "PARCELAMENTO_RECORRENTE"].includes(t)) return "outro";
  return "tarefa";
};

/** Tipos escolhidos que a conferência cobre (tarefas/prazos/atas). */
export const tiposConferidos = (tipos: string[]): TipoConferido[] => {
  const todos: TipoConferido[] = ["prazo", "tarefa", "ata"];
  return tipos.length === 0 ? todos : todos.filter((t) => tipos.includes(t));
};

export function tarefaCasaFiltros(t: TarefaConferencia, f: FiltrosConferencia): boolean {
  const tipo = classificarTarefa(t.tipo_tarefa);
  if (tipo === "outro" || !tiposConferidos(f.tipos).includes(tipo)) return false;
  const st = (t.status ?? "").toLowerCase();
  if (f.situacoes.length > 0) {
    if (!f.situacoes.some((v) => v.split("|").includes(st))) return false;
  } else if (st === "cancelado_oculto") return false;
  if (f.coordIds.length > 0 && (!t.coordenacao_id || !f.coordIds.includes(t.coordenacao_id))) return false;
  const dentro = (d: string) => !!d && (!f.inicio || d >= f.inicio) && (!f.fim || d <= f.fim);
  if (f.inicio || f.fim) {
    if (f.referencia === "cadastro") {
      if (!dentro(diaBrt(t.created_at))) return false;
    } else if (!dentro(diaBrt(t.data_vencimento)) && !dentro(diaBrt(t.data_fatal))) return false;
  }
  if (f.pessoaIds.length > 0) {
    const ehResp = t.responsaveis.some((id) => f.pessoaIds.includes(id));
    const ehEnv = t.envolvidos.some((id) => f.pessoaIds.includes(id));
    const { responsavel, envolvido } = f.papeis;
    if (responsavel && !envolvido) return ehResp;
    if (envolvido && !responsavel) return ehEnv;
    return ehResp || ehEnv;
  }
  return true;
}

/** ID-base de um item da agenda/planilha (tira sufixos de ocorrência). */
export const idBaseTarefa = (id: string) => String(id).split(":")[0];

export interface ResultadoConferencia {
  totalBanco: number;
  totalExportado: number;
  faltantes: TarefaConferencia[];
  tiposCobertos: TipoConferido[];
}

export function compararExportacao(
  doBanco: TarefaConferencia[],
  idsExportados: string[],
  f: FiltrosConferencia,
): ResultadoConferencia {
  const esperados = doBanco.filter((t) => tarefaCasaFiltros(t, f));
  const exportados = new Set(idsExportados.map(idBaseTarefa));
  const faltantes = esperados.filter((t) => !exportados.has(String(t.id)));
  return {
    totalBanco: esperados.length,
    totalExportado: esperados.length - faltantes.length,
    faltantes,
    tiposCobertos: tiposConferidos(f.tipos),
  };
}

type Lotes = <T>(consulta: (lote: string[]) => any, ids: string[]) => Promise<T[]>;

/** Busca no banco as tarefas candidatas e seus responsáveis/envolvidos. */
export async function buscarTarefasConferencia(
  supabase: any,
  inChunks: Lotes,
  f: FiltrosConferencia,
): Promise<TarefaConferencia[]> {
  const cols = "id, titulo, tipo_tarefa, status, data_vencimento, data_fatal, created_at, coordenacao_id";
  const ini = f.inicio ? new Date(f.inicio + "T00:00:00-03:00").toISOString() : null;
  const fim = f.fim ? new Date(f.fim + "T23:59:59-03:00").toISOString() : null;
  const statusEsc = Array.from(new Set(f.situacoes.flatMap((v) => v.split("|")).filter(Boolean)));

  const montar = (campo: string) => {
    let q = supabase.from("tarefas").select(cols);
    if (ini) q = q.gte(campo, ini);
    if (fim) q = q.lte(campo, fim);
    if (f.coordIds.length > 0) q = q.in("coordenacao_id", f.coordIds);
    if (statusEsc.length > 0) q = q.in("status", statusEsc);
    return q;
  };
  const lerTudo = async (campo: string) => {
    const out: any[] = [];
    for (let p = 0; p < 200; p++) {
      const { data, error } = await montar(campo).order("id").range(p * 1000, p * 1000 + 999);
      if (error) throw error;
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  const campos = f.referencia === "cadastro" ? ["created_at"] : ["data_vencimento", "data_fatal"];
  const mapa = new Map<string, any>();
  for (const c of campos) for (const r of await lerTudo(c)) mapa.set(String(r.id), r);
  const linhas = Array.from(mapa.values()).filter((r) => classificarTarefa(r.tipo_tarefa) !== "outro");
  const ids = linhas.map((r) => String(r.id));
  const resp = new Map<string, string[]>();
  const env = new Map<string, string[]>();
  if (f.pessoaIds.length > 0 && ids.length > 0) {
    const [rs, es] = await Promise.all([
      inChunks<any>((l) => supabase.from("tarefa_responsaveis").select("tarefa_id, usuario_id").in("tarefa_id", l), ids),
      inChunks<any>((l) => supabase.from("tarefa_envolvidos").select("tarefa_id, usuario_id").in("tarefa_id", l), ids),
    ]);
    const push = (m: Map<string, string[]>, r: any) => {
      if (!r?.usuario_id) return;
      const a = m.get(String(r.tarefa_id)) ?? [];
      a.push(String(r.usuario_id));
      m.set(String(r.tarefa_id), a);
    };
    (rs ?? []).forEach((r) => push(resp, r));
    (es ?? []).forEach((r) => push(env, r));
  }
  return linhas.map((r) => ({ ...r, id: String(r.id), responsaveis: resp.get(String(r.id)) ?? [], envolvidos: env.get(String(r.id)) ?? [] }));
}
