import { supabase } from "@/integrations/supabase/client";
import { applyDataEfetivaGte, applyDataEfetivaLte } from "@/hooks/useDistribuicoesTst";
import { aplicarMascaraCnj } from "@/utils/cnjMask";
import {
  chaveProcessoRelatorio,
  montarLinhaRelatorioDistribuicao,
  preencherModeloDistribuicao,
  type BennerRelatorio,
  type LinhaRelatorioDistribuicao,
  type ParteRelatorio,
  type ProcessoRelatorio,
  type PublicacaoRelatorio,
} from "./relatorioDistribuicaoModelo";

const COORDENACAO_TST_ID = "b0f690ad-68da-43d7-af5f-9adafeab3fd5";
const MODELO_URL = "/templates/modelo_exportacao_distribuicoes_tst.xlsx";
const PAGE = 1000;
const ENRICH_BATCH = 100;

export type FiltrosRelatorioDistribuicao = {
  campoData: "distribuicao" | "djen";
  de: string;
  ate: string;
  classificacao: "todas" | "inicial" | "tramite";
  origem: "todas" | "djen" | "manual";
  processo: string;
};

const COLUNAS = [
  "id", "processo", "turma", "relator", "recorrente", "reclamante", "reclamada",
  "advogados_internos", "tipo_recurso", "tipo_recurso_reclamante", "tipo_recurso_banco",
  "tipo_recurso_terceiro", "data_distribuicao_real", "data_distribuicao_planilha",
  "data_distribuicao", "data_publicacao_djen", "tribunal",
].join(", ");

function queryBase(filtros: FiltrosRelatorioDistribuicao) {
  let q = supabase
    .from("dados_benner")
    .select(COLUNAS)
    .not("aba_origem", "is", null);

  if (filtros.campoData === "distribuicao") {
    if (filtros.de) q = applyDataEfetivaGte(q, filtros.de);
    if (filtros.ate) q = applyDataEfetivaLte(q, filtros.ate);
  } else {
    if (filtros.de) q = q.gte("data_publicacao_djen", filtros.de);
    if (filtros.ate) q = q.lte("data_publicacao_djen", filtros.ate);
  }
  if (filtros.origem === "djen") q = q.not("importado_djen_em", "is", null);
  if (filtros.origem === "manual") q = q.is("importado_djen_em", null);

  const busca = filtros.processo.trim();
  if (busca) {
    const apenasDigitos = busca.replace(/\D/g, "");
    const processo = apenasDigitos.length === 20 ? aplicarMascaraCnj(apenasDigitos) : busca;
    q = q.ilike("processo", `%${processo}%`);
  }
  return q;
}

async function carregarBase(
  filtros: FiltrosRelatorioDistribuicao,
  onProgress?: (mensagem: string) => void,
): Promise<BennerRelatorio[]> {
  const linhas: BennerRelatorio[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await queryBase(filtros).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const pagina = (data || []) as unknown as BennerRelatorio[];
    linhas.push(...pagina);
    onProgress?.(`${linhas.length} distribuição(ões) encontrada(s)…`);
    if (pagina.length < PAGE) break;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return linhas;
}

function escolherProcesso(atual: ProcessoRelatorio | undefined, candidato: ProcessoRelatorio): ProcessoRelatorio {
  if (!atual) return candidato;
  if (atual.coordenacao_id === COORDENACAO_TST_ID) return atual;
  return candidato.coordenacao_id === COORDENACAO_TST_ID ? candidato : atual;
}

async function completarDados(
  base: BennerRelatorio[],
  onProgress?: (mensagem: string) => void,
): Promise<LinhaRelatorioDistribuicao[]> {
  const resultado: LinhaRelatorioDistribuicao[] = [];
  for (let i = 0; i < base.length; i += ENRICH_BATCH) {
    const lote = base.slice(i, i + ENRICH_BATCH);
    const ids = lote.map((l) => l.id);
    const numeros = Array.from(new Set(lote.map((l) => String(l.processo || "").trim()).filter(Boolean)));

    const [partesResp, processosResp, publicacoesResp] = await Promise.all([
      supabase
        .from("partes_processo_benner")
        .select("dados_benner_id, nome, polo, is_advogado")
        .in("dados_benner_id", ids),
      numeros.length
        ? supabase
          .from("processos")
          .select("numero, orgao_julgador, classe, polo_ativo, polo_passivo, advogados_identificados, tribunal, coordenacao_id")
          .in("numero", numeros)
        : Promise.resolve({ data: [], error: null }),
      numeros.length
        ? supabase
          .from("publicacoes_djen")
          .select("processo_numero, orgao, conteudo, polo_ativo, polo_passivo, advogados_json, data_disponibilizacao, data_publicacao, tribunal")
          .eq("coordenacao_id", COORDENACAO_TST_ID)
          .in("processo_numero", numeros)
          .order("data_publicacao", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (partesResp.error) throw new Error(partesResp.error.message);
    if (processosResp.error) throw new Error(processosResp.error.message);
    if (publicacoesResp.error) throw new Error(publicacoesResp.error.message);

    const partesMap = new Map<string, ParteRelatorio[]>();
    for (const parte of partesResp.data || []) {
      const lista = partesMap.get(parte.dados_benner_id) || [];
      lista.push(parte);
      partesMap.set(parte.dados_benner_id, lista);
    }
    const processosMap = new Map<string, ProcessoRelatorio>();
    for (const processo of processosResp.data || []) {
      const chave = chaveProcessoRelatorio(processo.numero);
      processosMap.set(chave, escolherProcesso(processosMap.get(chave), processo));
    }
    const publicacoesMap = new Map<string, PublicacaoRelatorio>();
    for (const pub of publicacoesResp.data || []) {
      const chave = chaveProcessoRelatorio(pub.processo_numero);
      if (!publicacoesMap.has(chave)) publicacoesMap.set(chave, pub);
    }

    for (const item of lote) {
      const chave = chaveProcessoRelatorio(item.processo);
      resultado.push(montarLinhaRelatorioDistribuicao(
        item,
        partesMap.get(item.id) || [],
        processosMap.get(chave),
        publicacoesMap.get(chave),
      ));
    }
    onProgress?.(`Completando dados: ${Math.min(i + ENRICH_BATCH, base.length)} de ${base.length}…`);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return resultado;
}

export async function buscarLinhasRelatorioDistribuicao(
  filtros: FiltrosRelatorioDistribuicao,
  onProgress?: (mensagem: string) => void,
): Promise<LinhaRelatorioDistribuicao[]> {
  const base = await carregarBase(filtros, onProgress);
  const linhas = await completarDados(base, onProgress);
  return linhas
    .filter((linha) => filtros.classificacao === "todas"
      || (filtros.classificacao === "inicial" && linha.classificacao === "DISTRIBUIÇÃO INICIAL")
      || (filtros.classificacao === "tramite" && linha.classificacao === "TRÂMITE INTERNO"))
    .sort((a, b) => (a.ordemData || "9999-12-31").localeCompare(b.ordemData || "9999-12-31")
      || a.processo.localeCompare(b.processo, "pt-BR"));
}

export async function gerarRelatorioDistribuicaoModelo(
  filtros: FiltrosRelatorioDistribuicao,
  onProgress?: (mensagem: string) => void,
): Promise<{ blob: Blob; filename: string; total: number }> {
  const linhas = await buscarLinhasRelatorioDistribuicao(filtros, onProgress);
  if (!linhas.length) return { blob: new Blob(), filename: "", total: 0 };

  onProgress?.("Montando o Excel no modelo enviado…");
  const [templateResponse, ExcelJS] = await Promise.all([
    fetch(MODELO_URL),
    import("exceljs").then((module) => module.default),
  ]);
  if (!templateResponse.ok) throw new Error("Não foi possível abrir o modelo do relatório.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await templateResponse.arrayBuffer());
  const blob = await preencherModeloDistribuicao(workbook, linhas);
  const periodo = filtros.de || filtros.ate ? `_${filtros.de || "inicio"}_a_${filtros.ate || "fim"}` : "";
  return {
    blob,
    filename: `Relatorio_Distribuicao_TST${periodo}.xlsx`,
    total: linhas.length,
  };
}
