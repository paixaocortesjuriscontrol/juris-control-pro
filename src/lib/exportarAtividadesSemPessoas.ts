import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

type Fonte = "tarefa" | "evento" | "audiencia";
type LinhaBase = {
  id: string;
  titulo?: string | null;
  tipo_audiencia?: string | null;
  tipo_tarefa?: string | null;
  tipo_registro?: string | null;
  tipo?: string | null;
  status?: string | null;
  data_vencimento?: string | null;
  data_fatal?: string | null;
  data_inicio?: string | null;
  data_audiencia?: string | null;
  processo_id?: string | null;
  processo_numero?: string | null;
  coordenacao_id?: string | null;
  origem?: string | null;
  criado_por?: string | null;
  criado_por_nome?: string | null;
  created_at?: string | null;
};

export type AtividadeSemPessoas = LinhaBase & {
  fonte: Fonte;
  tipo: "Tarefa" | "Prazo" | "Ata" | "Evento" | "Audiência" | "Parcelamento";
};

const CAMPOS: Record<Fonte, string> = {
  tarefa: "id, titulo, tipo_tarefa, tipo_registro, status, data_vencimento, data_fatal, processo_id, coordenacao_id, origem, criado_por, criado_por_nome, created_at",
  evento: "id, titulo, tipo, status, data_inicio, processo_id, coordenacao_id, origem, criado_por, created_at",
  audiencia: "id, titulo, tipo_audiencia, status, data_audiencia, processo_id, processo_numero, coordenacao_id, origem, criado_por, created_at",
};

function tipoTarefa(row: LinhaBase): AtividadeSemPessoas["tipo"] {
  const tipo = String(row.tipo_tarefa || row.tipo_registro || "").trim().toUpperCase();
  if (tipo === "ATA") return "Ata";
  if (tipo.includes("PRAZO")) return "Prazo";
  return "Tarefa";
}

async function buscarPaginas(fonte: Fonte, coordenacaoIds: string[]): Promise<LinhaBase[]> {
  const tabela = fonte === "tarefa" ? "tarefas" : fonte === "evento" ? "eventos_agenda" : "audiencias_detectadas";
  const resultado: LinhaBase[] = [];
  for (let from = 0; ; from += 1000) {
    let query = (supabase as any).from(tabela).select(CAMPOS[fonte]).order("id").range(from, from + 999);
    if (fonte === "tarefa") query = query.is("responsavel_id", null);
    if (coordenacaoIds.length > 0) query = query.in("coordenacao_id", coordenacaoIds);
    const { data, error } = await query;
    if (error) throw error;
    resultado.push(...((data || []) as LinhaBase[]));
    if (!data || data.length < 1000) break;
  }
  return resultado;
}

async function idsVinculados(tabela: string, colunaItem: string, colunaPessoa: string, ids: string[]): Promise<Set<string>> {
  const vinculados = new Set<string>();
  for (let i = 0; i < ids.length; i += 150) {
    const parte = ids.slice(i, i + 150);
    const { data, error } = await (supabase as any)
      .from(tabela)
      .select(`${colunaItem}, ${colunaPessoa}`)
      .in(colunaItem, parte);
    if (error) throw error;
    (data || []).forEach((row: any) => {
      if (row[colunaPessoa]) vinculados.add(String(row[colunaItem]));
    });
  }
  return vinculados;
}

async function buscarSemPessoas(fonte: Fonte, coordenacaoIds: string[]): Promise<AtividadeSemPessoas[]> {
  const rows = await buscarPaginas(fonte, coordenacaoIds);
  const ids = rows.map((row) => row.id);
  const [responsaveis, envolvidos, participantes] = await Promise.all([
    fonte === "tarefa"
      ? idsVinculados("tarefa_responsaveis", "tarefa_id", "usuario_id", ids)
      : fonte === "evento"
        ? idsVinculados("evento_responsaveis", "evento_id", "usuario_id", ids)
        : idsVinculados("audiencias_advogados", "audiencia_id", "advogado_id", ids),
    fonte === "tarefa"
      ? idsVinculados("tarefa_envolvidos", "tarefa_id", "usuario_id", ids)
      : fonte === "evento"
        ? idsVinculados("evento_envolvidos", "evento_id", "usuario_id", ids)
        : idsVinculados("audiencia_envolvidos", "audiencia_id", "usuario_id", ids),
    fonte === "evento"
      ? idsVinculados("participantes_evento", "evento_id", "usuario_id", ids)
      : Promise.resolve(new Set<string>()),
  ]);
  return rows
    .filter((row) => !responsaveis.has(row.id) && !envolvidos.has(row.id) && !participantes.has(row.id))
    .map((row) => ({
      ...row,
      fonte,
      tipo: fonte === "tarefa"
        ? tipoTarefa(row)
        : fonte === "audiencia"
          ? "Audiência"
          : String(row.tipo || "").toLowerCase() === "parcelamento"
            ? "Parcelamento"
            : "Evento",
    }));
}

async function buscarPorIds(tabela: string, campos: string, ids: string[]): Promise<any[]> {
  const resultado: any[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await (supabase as any)
      .from(tabela)
      .select(campos)
      .in("id", ids.slice(i, i + 150));
    if (error) throw error;
    resultado.push(...(data || []));
  }
  return resultado;
}

function dataAtividade(row: AtividadeSemPessoas): string | null {
  return row.data_vencimento || row.data_inicio || row.data_audiencia || null;
}

function textoData(value?: string | null, comHora = false): string {
  if (!value) return "";
  const apenasData = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-03:00` : value;
  const data = toZonedTime(new Date(apenasData), "America/Sao_Paulo");
  return Number.isNaN(data.getTime()) ? String(value) : format(data, comHora ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy");
}

export async function buscarAtividadesAntigasSemPessoas(coordenacaoIds: string[] = []): Promise<AtividadeSemPessoas[]> {
  const grupos: AtividadeSemPessoas[][] = [];
  // Sequencial para não disparar dezenas de consultas de vínculos ao mesmo tempo.
  for (const fonte of ["tarefa", "evento", "audiencia"] as Fonte[]) {
    grupos.push(await buscarSemPessoas(fonte, coordenacaoIds));
  }
  return grupos.flat().sort((a, b) =>
    `${a.coordenacao_id || ""}|${dataAtividade(a) || ""}|${a.titulo || ""}`
      .localeCompare(`${b.coordenacao_id || ""}|${dataAtividade(b) || ""}|${b.titulo || ""}`),
  );
}

export async function exportarAtividadesAntigasSemPessoas(coordenacaoIds: string[] = []): Promise<number> {
  const itens = await buscarAtividadesAntigasSemPessoas(coordenacaoIds);
  const coordenacaoIdsEncontrados = Array.from(new Set(itens.map((i) => i.coordenacao_id).filter(Boolean))) as string[];
  const processoIds = Array.from(new Set(itens.map((i) => i.processo_id).filter(Boolean))) as string[];
  const pessoaIds = Array.from(new Set(itens.map((i) => i.criado_por).filter(Boolean))) as string[];

  const [coordenadas, processos, pessoas] = await Promise.all([
    buscarPorIds("coordenacoes", "id, nome", coordenacaoIdsEncontrados),
    buscarPorIds("processos", "id, numero", processoIds),
    buscarPorIds("profiles_basic", "id, nome", pessoaIds),
  ]);

  const nomeCoord = new Map(coordenadas.map((c: any) => [c.id, c.nome]));
  const numeroProcesso = new Map(processos.map((p: any) => [p.id, p.numero]));
  const nomePessoa = new Map(pessoas.map((p: any) => [p.id, p.nome]));

  const detalhes = itens.map((item) => ({
    "ID da atividade": item.id,
    "Tipo": item.tipo,
    "Título": item.titulo || item.tipo_audiencia || "(sem título)",
    "Situação": item.status || "",
    "Data prevista/início": textoData(dataAtividade(item)),
    "Data fatal": textoData(item.data_fatal),
    "Processo": item.processo_numero || numeroProcesso.get(item.processo_id || "") || "",
    "Coordenação": nomeCoord.get(item.coordenacao_id || "") || "Sem coordenação",
    "Origem": item.origem || "",
    "Criado por": item.criado_por_nome || nomePessoa.get(item.criado_por || "") || "",
    "Criado em (Brasília)": textoData(item.created_at, true),
    "Correção necessária": "Escolher pelo menos um responsável ou envolvido",
  }));

  const resumoMap = new Map<string, number>();
  itens.forEach((item) => {
    const chave = `${item.tipo}|${nomeCoord.get(item.coordenacao_id || "") || "Sem coordenação"}`;
    resumoMap.set(chave, (resumoMap.get(chave) || 0) + 1);
  });
  const resumo = Array.from(resumoMap.entries()).map(([chave, total]) => {
    const [tipo, coordenacao] = chave.split("|");
    return { Tipo: tipo, Coordenação: coordenacao, Total: total };
  });
  resumo.unshift({ Tipo: "TOTAL GERAL", Coordenação: "Todas", Total: itens.length });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhes), "Atividades sem pessoas");
  const dataArquivo = format(toZonedTime(new Date(), "America/Sao_Paulo"), "yyyy-MM-dd");
  XLSX.writeFile(wb, `atividades_antigas_sem_pessoas_${dataArquivo}.xlsx`);
  return itens.length;
}
