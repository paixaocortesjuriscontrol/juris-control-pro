/**
 * Conferência independente da exportação "Exportar Atividade" do Painel:
 * lê tarefas/prazos/atas, audiências e eventos direto das tabelas (mesma
 * sessão, RLS valendo) com os filtros escolhidos e compara com a planilha.
 */
export type TipoConferido = "prazo" | "tarefa" | "ata" | "audiencia" | "evento";
export const TIPOS_CONFERIDOS: TipoConferido[] = ["prazo", "tarefa", "ata", "audiencia", "evento"];
export const NOMES_TIPO_CONFERIDO: Record<TipoConferido, string> = {
  prazo: "Prazos", tarefa: "Tarefas", ata: "Atas", audiencia: "Audiências", evento: "Eventos",
};

export interface ItemConferencia {
  /** "t:<id>" tarefa, "a:<id>" audiência, "e:<id>" evento */
  chave: string;
  tipo: TipoConferido | "outro";
  titulo?: string | null;
  status?: string | null;
  data_vencimento?: string | null; // limite / data da audiência / início do evento
  data_fatal?: string | null;
  created_at?: string | null;
  coordenacao_id?: string | null;
  responsaveis: string[];
  envolvidos: string[];
}

export interface FiltrosConferencia {
  inicio: string;
  fim: string;
  tipos: string[];
  situacoes: string[];
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
  if (t === "AUDIÊNCIA" || t === "AUDIENCIA") return "audiencia";
  if (t === "EVENTO") return "evento";
  if (t === "PARCELAMENTO" || t === "PARCELAMENTO_RECORRENTE") return "outro";
  return "tarefa";
};
export const classificarEvento = (tipo?: string | null): TipoConferido | "outro" => {
  const t = (tipo ?? "").toLowerCase();
  if (t === "prazo" || t === "prazo_parcela") return "prazo";
  if (t === "parcelamento") return "outro";
  return "evento";
};
/** Audiência usa a mesma situação unificada da agenda. */
export const statusAudiencia = (s?: string | null) =>
  s === "cumprido" || s === "concluido" ? "concluido" : s || "pendente";

export const tiposConferidos = (tipos: string[]): TipoConferido[] =>
  tipos.length === 0 ? TIPOS_CONFERIDOS : TIPOS_CONFERIDOS.filter((t) => tipos.includes(t));

export function itemCasaFiltros(t: ItemConferencia, f: FiltrosConferencia): boolean {
  if (t.tipo === "outro" || !tiposConferidos(f.tipos).includes(t.tipo)) return false;
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

/** Chave de um item exportado (agenda), sem sufixos de ocorrência. */
export function chaveItemExportado(it: { id: any; origem?: string }): string | null {
  const raw = String(it.id);
  if (raw.startsWith("audiencia-det-")) return `a:${raw.replace("audiencia-det-", "")}`;
  if (raw.startsWith("prazo-tst-")) return null;
  if (it.origem === "tarefa") return `t:${raw.split(":")[0]}`;
  if (it.origem === "evento") return `e:${raw.split(":")[0]}`;
  return null;
}

export interface TotalPorTipo { tipo: TipoConferido; banco: number; exportado: number; faltando: number }
export interface ResultadoConferencia {
  totalBanco: number;
  totalExportado: number;
  faltantes: ItemConferencia[];
  tiposCobertos: TipoConferido[];
  porTipo: TotalPorTipo[];
}

export function compararExportacao(
  doBanco: ItemConferencia[],
  chavesExportadas: string[],
  f: FiltrosConferencia,
): ResultadoConferencia {
  const vistos = new Set<string>();
  const esperados = doBanco.filter((t) => {
    if (vistos.has(t.chave) || !itemCasaFiltros(t, f)) return false;
    vistos.add(t.chave);
    return true;
  });
  const exportados = new Set(chavesExportadas);
  const faltantes = esperados.filter((t) => !exportados.has(t.chave));
  const tiposCobertos = tiposConferidos(f.tipos);
  const porTipo = tiposCobertos.map((tipo) => {
    const banco = esperados.filter((e) => e.tipo === tipo).length;
    const faltando = faltantes.filter((e) => e.tipo === tipo).length;
    return { tipo, banco, exportado: banco - faltando, faltando };
  });
  return {
    totalBanco: esperados.length,
    totalExportado: esperados.length - faltantes.length,
    faltantes,
    tiposCobertos,
    porTipo,
  };
}

type Lotes = <T>(consulta: (lote: string[]) => any, ids: string[]) => Promise<T[]>;

async function lerPaginado(montar: () => any) {
  const out: any[] = [];
  for (let p = 0; p < 200; p++) {
    const { data, error } = await montar().order("id").range(p * 1000, p * 1000 + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function vinculos(
  supabase: any, inChunks: Lotes, tabela: string, campoItem: string, campoPessoa: string, ids: string[],
) {
  const m = new Map<string, string[]>();
  if (ids.length === 0) return m;
  const rows = await inChunks<any>(
    (l) => supabase.from(tabela).select(`${campoItem}, ${campoPessoa}`).in(campoItem, l), ids,
  );
  (rows ?? []).forEach((r: any) => {
    if (!r?.[campoPessoa]) return;
    const k = String(r[campoItem]);
    const a = m.get(k) ?? [];
    a.push(String(r[campoPessoa]));
    m.set(k, a);
  });
  return m;
}

function janela(f: FiltrosConferencia) {
  return {
    ini: f.inicio ? new Date(f.inicio + "T00:00:00-03:00").toISOString() : null,
    fim: f.fim ? new Date(f.fim + "T23:59:59-03:00").toISOString() : null,
  };
}

/** Busca no banco os itens candidatos de todos os tipos escolhidos. */
export async function buscarItensConferencia(
  supabase: any, inChunks: Lotes, f: FiltrosConferencia,
): Promise<ItemConferencia[]> {
  const tipos = tiposConferidos(f.tipos);
  const { ini, fim } = janela(f);
  const statusEsc = Array.from(new Set(f.situacoes.flatMap((v) => v.split("|")).filter(Boolean)));
  const porPessoas = f.pessoaIds.length > 0;
  const lerPorCampos = async (tabela: string, cols: string, campos: string[], aplicarStatus: boolean) => {
    const mapa = new Map<string, any>();
    for (const campo of campos) {
      const rows = await lerPaginado(() => {
        let q = supabase.from(tabela).select(cols);
        if (ini) q = q.gte(campo, ini);
        if (fim) q = q.lte(campo, fim);
        if (f.coordIds.length > 0) q = q.in("coordenacao_id", f.coordIds);
        if (aplicarStatus && statusEsc.length > 0) q = q.in("status", statusEsc);
        return q;
      });
      rows.forEach((r) => mapa.set(String(r.id), r));
    }
    return Array.from(mapa.values());
  };
  const cad = f.referencia === "cadastro";
  const out: ItemConferencia[] = [];

  // Tarefas (prazos, tarefas, atas e as audiências/eventos antigos guardados como tarefa)
  const tarefas = (await lerPorCampos(
    "tarefas", "id, titulo, tipo_tarefa, status, data_vencimento, data_fatal, created_at, coordenacao_id",
    cad ? ["created_at"] : ["data_vencimento", "data_fatal"], true,
  )).filter((r) => tipos.includes(classificarTarefa(r.tipo_tarefa) as TipoConferido));
  const tIds = tarefas.map((r) => String(r.id));
  const [tResp, tEnv] = porPessoas
    ? await Promise.all([
        vinculos(supabase, inChunks, "tarefa_responsaveis", "tarefa_id", "usuario_id", tIds),
        vinculos(supabase, inChunks, "tarefa_envolvidos", "tarefa_id", "usuario_id", tIds),
      ])
    : [new Map(), new Map()];
  tarefas.forEach((r) => out.push({
    chave: `t:${r.id}`, tipo: classificarTarefa(r.tipo_tarefa), titulo: r.titulo, status: r.status,
    data_vencimento: r.data_vencimento, data_fatal: r.data_fatal, created_at: r.created_at,
    coordenacao_id: r.coordenacao_id,
    responsaveis: tResp.get(String(r.id)) ?? [], envolvidos: tEnv.get(String(r.id)) ?? [],
  }));

  if (tipos.includes("audiencia")) {
    // Situação da audiência é convertida (cumprido → concluído), então filtra depois.
    const auds = await lerPorCampos(
      "audiencias_detectadas", "id, titulo, status, data_audiencia, created_at, coordenacao_id",
      [cad ? "created_at" : "data_audiencia"], false,
    );
    const ids = auds.map((r) => String(r.id));
    const [aResp, aEnv] = porPessoas
      ? await Promise.all([
          vinculos(supabase, inChunks, "audiencias_advogados", "audiencia_id", "advogado_id", ids),
          vinculos(supabase, inChunks, "audiencia_envolvidos", "audiencia_id", "usuario_id", ids),
        ])
      : [new Map(), new Map()];
    auds.forEach((r) => out.push({
      chave: `a:${r.id}`, tipo: "audiencia", titulo: r.titulo, status: statusAudiencia(r.status),
      data_vencimento: r.data_audiencia, created_at: r.created_at, coordenacao_id: r.coordenacao_id,
      responsaveis: aResp.get(String(r.id)) ?? [], envolvidos: aEnv.get(String(r.id)) ?? [],
    }));
  }

  if (tipos.includes("evento") || tipos.includes("prazo")) {
    const evs = (await lerPorCampos(
      "eventos_agenda", "id, titulo, tipo, status, data_inicio, created_at, coordenacao_id",
      [cad ? "created_at" : "data_inicio"], true,
    )).filter((r) => tipos.includes(classificarEvento(r.tipo) as TipoConferido));
    const ids = evs.map((r) => String(r.id));
    const [eResp, eEnv] = porPessoas
      ? await Promise.all([
          vinculos(supabase, inChunks, "evento_responsaveis", "evento_id", "usuario_id", ids),
          vinculos(supabase, inChunks, "evento_envolvidos", "evento_id", "usuario_id", ids),
        ])
      : [new Map(), new Map()];
    evs.forEach((r) => out.push({
      chave: `e:${r.id}`, tipo: classificarEvento(r.tipo), titulo: r.titulo, status: r.status,
      data_vencimento: r.data_inicio, created_at: r.created_at, coordenacao_id: r.coordenacao_id,
      responsaveis: eResp.get(String(r.id)) ?? [], envolvidos: eEnv.get(String(r.id)) ?? [],
    }));
  }
  return out;
}
