import { supabase } from "@/integrations/supabase/client";
import {
  fetchTodosProcessosFiltrados,
  type ProcessosPaginadosFilters,
} from "@/hooks/useProcessosPaginados";

/** Evita a explosão de parsing de tipos das select strings do supabase-js. */
const sel = (s: string): string => s;

export type EscopoExportacao = "filtros" | "selecionados" | "tudo";

export interface EscopoParams {
  escopo: EscopoExportacao;
  filtros: ProcessosPaginadosFilters;
  selecionados: string[];
}

const PROCESSO_COLS = `
  id, numero, assunto, status, situacao_original, area, tipo_processo, descricao,
  justica, uf, comarca, instancia, tribunal, vara, orgao_julgador, orgao_origem,
  pasta_fisica, pasta_cliente, sistema, fase, classe, data_distribuicao,
  valor_causa, probabilidade, risco, polo_ativo, polo_passivo,
  cpf_cnpj_parte_contraria, funcao_parte_contraria, nome_cliente_envolvido,
  unidade_cliente, acompanhamento_especial, cliente_id, advogado_responsavel_id
`;

export interface ProcessoExport {
  [key: string]: any;
}

/** Resolve os IDs de processos do escopo escolhido. */
export async function resolverIdsEscopo(
  { escopo, filtros, selecionados }: EscopoParams,
  onProgress?: (carregados: number, total: number) => void
): Promise<string[]> {
  if (escopo === "selecionados") return [...selecionados];
  const filters = escopo === "tudo" ? {} : filtros;
  const rows = await fetchTodosProcessosFiltrados(filters, onProgress);
  return rows.map((r: any) => r.id).filter(Boolean);
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Carrega os processos completos (com cliente e responsável) em lotes. */
export async function carregarProcessosCompletos(
  ids: string[],
  onProgress?: (carregados: number, total: number) => void
): Promise<ProcessoExport[]> {
  const out: ProcessoExport[] = [];
  for (const parte of chunk(ids, 300)) {
    const { data, error } = await supabase
      .from("processos")
      .select(sel(PROCESSO_COLS))
      .in("id", parte)
      .returns<ProcessoExport[]>();
    if (error) throw error;
    out.push(...(data || []));
    onProgress?.(out.length, ids.length);
  }

  // Clientes
  const clienteIds = [...new Set(out.map((p) => p.cliente_id).filter(Boolean))] as string[];
  const clientes = new Map<string, { nome: string; documento?: string | null }>();
  for (const parte of chunk(clienteIds, 300)) {
    const { data } = await supabase
      .from("clientes")
      .select(sel("id, nome, documento"))
      .in("id", parte)
      .returns<any[]>();
    (data || []).forEach((c) => clientes.set(c.id, { nome: c.nome, documento: c.documento }));
  }

  // Responsável principal
  const respIds = [
    ...new Set(out.map((p) => p.advogado_responsavel_id).filter(Boolean)),
  ] as string[];
  const perfis = new Map<string, string>();
  for (const parte of chunk(respIds, 300)) {
    const { data } = await supabase
      .from("profiles")
      .select(sel("id, nome"))
      .in("id", parte)
      .returns<any[]>();
    (data || []).forEach((p) => perfis.set(p.id, p.nome));
  }

  out.forEach((p) => {
    p.cliente_nome = p.cliente_id ? clientes.get(p.cliente_id)?.nome || "" : "";
    p.cliente_documento = p.cliente_id ? clientes.get(p.cliente_id)?.documento || "" : "";
    p.responsavel_nome = p.advogado_responsavel_id
      ? perfis.get(p.advogado_responsavel_id) || ""
      : "";
  });

  return out;
}

/** Responsáveis (todos, ativos) por processo — nomes em maiúsculas. */
export async function carregarResponsaveisPorProcesso(
  ids: string[]
): Promise<Map<string, string[]>> {
  const vinculos: { processo_id: string; usuario_id: string }[] = [];
  for (const parte of chunk(ids, 300)) {
    const { data } = await supabase
      .from("processos_responsaveis")
      .select(sel("processo_id, usuario_id, ativo"))
      .in("processo_id", parte)
      .returns<any[]>();
    (data || [])
      .filter((v) => v.ativo !== false)
      .forEach((v) => vinculos.push({ processo_id: v.processo_id, usuario_id: v.usuario_id }));
  }

  const userIds = [...new Set(vinculos.map((v) => v.usuario_id).filter(Boolean))];
  const nomes = new Map<string, string>();
  for (const parte of chunk(userIds, 300)) {
    const { data } = await supabase
      .from("profiles")
      .select(sel("id, nome"))
      .in("id", parte)
      .returns<any[]>();
    (data || []).forEach((p) => nomes.set(p.id, (p.nome || "").toUpperCase()));
  }

  const map = new Map<string, string[]>();
  vinculos.forEach((v) => {
    const nome = nomes.get(v.usuario_id);
    if (!nome) return;
    const atual = map.get(v.processo_id) || [];
    if (!atual.includes(nome)) atual.push(nome);
    map.set(v.processo_id, atual);
  });
  return map;
}

/** Partes cadastradas por processo (ativo/passivo/terceiro). */
export async function carregarPartesPorProcesso(ids: string[]) {
  const map = new Map<string, any[]>();
  for (const parte of chunk(ids, 300)) {
    const { data } = await supabase
      .from("processos_partes")
      .select(sel("processo_id, nome, documento, polo, lado_efetivo, is_advogado"))
      .in("processo_id", parte)
      .returns<any[]>();
    (data || [])
      .filter((p) => !p.is_advogado)
      .forEach((p) => {
        const atual = map.get(p.processo_id) || [];
        atual.push(p);
        map.set(p.processo_id, atual);
      });
  }
  return map;
}

/** Movimentações (andamentos) do período, por processo. */
export async function carregarMovimentacoes(
  ids: string[],
  inicio: string | null,
  fim: string | null,
  onProgress?: (carregados: number, total: number) => void
) {
  const out: any[] = [];
  let processados = 0;
  for (const parte of chunk(ids, 200)) {
    let query = supabase
      .from("movimentacoes")
      .select(sel("processo_id, data_movimentacao, descricao, tipo, fonte"))
      .in("processo_id", parte);
    if (inicio) query = query.gte("data_movimentacao", inicio);
    if (fim) query = query.lte("data_movimentacao", fim);
    const { data, error } = await query
      .order("data_movimentacao", { ascending: false })
      .limit(50000)
      .returns<any[]>();
    if (error) throw error;
    out.push(...(data || []));
    processados += parte.length;
    onProgress?.(processados, ids.length);
  }
  return out;
}

export function formatarDataBr(valor: any): string {
  if (!valor) return "";
  const s = String(valor);
  const iso = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  return s;
}

const MAX_CELL = 32000;
export function cap(valor: any): string {
  const s = valor === null || valor === undefined ? "" : String(valor);
  return s.length > MAX_CELL ? `${s.slice(0, MAX_CELL)} […texto truncado]` : s;
}
