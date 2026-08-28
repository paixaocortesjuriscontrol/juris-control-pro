import {
  cap,
  carregarPartesPorProcesso,
  carregarProcessosCompletos,
  formatarDataBr,
  resolverIdsEscopo,
  type EscopoParams,
} from "./exportProcessosModelosData";

const COLUNAS = [
  "Tipo",
  "Assunto",
  "Situação",
  "Responsável",
  "Grupo de trabalho",
  "Marcadores",
  "Pasta Física",
  "Descrição",
  "Justiça",
  "Cidade",
  "Estado",
  "Instância",
  "Órgão (Comarca / Tribunal)",
  "Órgão Julgador (Vara / Câmara)",
  "Número do processo",
  "Numeração Outro Padrão",
  "Sistema",
  "Área",
  "Fase",
  "Distribuído",
  "Classe – CNJ",
  "Valor da ação",
  "Probabilidade",
  "Risco",
  "Parte Ativa",
  "Envolvimento Ativo",
  "CPF/CNPJ Parte Ativa",
  "Parte Passiva",
  "Envolvimento Passivo",
  "CPF/CNPJ Parte Passiva",
  "Parte Terceira",
  "Envolvimento Terceiro",
  "CPF/CNPJ Terceiro",
  "Nome Parte Cliente",
  "Complemento Órgão Julgador",
  "Código externo",
  "Código externo adicional",
  "Carteira",
];

const situacaoLabels: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  urgente: "Urgente",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
  arquivado_parcialmente: "Arquivado Parcialmente",
  arquivado_definitivamente: "Arquivado Definitivamente",
  suspenso: "Suspenso",
};

const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
  direito_privado: "Direito Privado",
  caso: "Caso",
};

interface Opcoes extends EscopoParams {
  onProgress?: (mensagem: string) => void;
}

function tipoLinha(p: any): string {
  if (p.area === "caso" || p.tipo_processo === "caso") return "Caso";
  if (p.tipo_processo === "administrativo") return "Administrativo";
  return "Judicial";
}

/** Gera o Excel no formato "modelo importação cadastro de processo em lote". */
export async function exportarExcelCadastroLote(opcoes: Opcoes): Promise<number> {
  const { onProgress } = opcoes;
  const XLSX = await import("xlsx");

  onProgress?.("Selecionando processos...");
  const ids = await resolverIdsEscopo(opcoes, (c, t) =>
    onProgress?.(`Selecionando processos ${c} de ${t}...`)
  );
  if (ids.length === 0) return 0;

  onProgress?.("Carregando dados dos processos...");
  const processos = await carregarProcessosCompletos(ids, (c, t) =>
    onProgress?.(`Carregando processos ${c} de ${t}...`)
  );
  const partesMap = await carregarPartesPorProcesso(ids);

  const rows = processos.map((p) => {
    const partes = partesMap.get(p.id) || [];
    const ativo = partes.find((x) => x.polo === "ativo" || x.lado_efetivo === "ativo");
    const passivo = partes.find((x) => x.polo === "passivo" || x.lado_efetivo === "passivo");
    const terceiro = partes.find(
      (x) => x.polo && !["ativo", "passivo"].includes(String(x.polo))
    );

    return {
      Tipo: tipoLinha(p),
      Assunto: cap(p.assunto),
      "Situação": situacaoLabels[p.status] || cap(p.situacao_original || p.status),
      "Responsável": cap(String(p.responsavel_nome || "").toUpperCase()),
      "Grupo de trabalho": "",
      Marcadores: "",
      "Pasta Física": cap(p.pasta_fisica || p.pasta_cliente),
      "Descrição": cap(p.descricao),
      "Justiça": cap(p.justica),
      Cidade: cap(p.comarca),
      Estado: cap(p.uf),
      "Instância": cap(p.instancia),
      "Órgão (Comarca / Tribunal)": cap(p.tribunal || p.comarca),
      "Órgão Julgador (Vara / Câmara)": cap(p.vara || p.orgao_julgador),
      "Número do processo": cap(p.numero),
      "Numeração Outro Padrão": "",
      Sistema: cap(p.sistema),
      "Área": areaLabels[p.area] || cap(p.area),
      Fase: cap(p.fase),
      "Distribuído": formatarDataBr(p.data_distribuicao),
      "Classe – CNJ": cap(p.classe),
      "Valor da ação": p.valor_causa ?? "",
      Probabilidade: cap(p.probabilidade),
      Risco: cap(p.risco),
      "Parte Ativa": cap(ativo?.nome || p.polo_ativo),
      "Envolvimento Ativo": cap(ativo ? "Requerente" : ""),
      "CPF/CNPJ Parte Ativa": cap(ativo?.documento),
      "Parte Passiva": cap(passivo?.nome || p.polo_passivo),
      "Envolvimento Passivo": cap(passivo ? "Requerido" : ""),
      "CPF/CNPJ Parte Passiva": cap(passivo?.documento || p.cpf_cnpj_parte_contraria),
      "Parte Terceira": cap(terceiro?.nome),
      "Envolvimento Terceiro": cap(terceiro ? "Terceiro" : ""),
      "CPF/CNPJ Terceiro": cap(terceiro?.documento),
      "Nome Parte Cliente": cap(p.nome_cliente_envolvido || p.cliente_nome),
      "Complemento Órgão Julgador": cap(p.orgao_origem),
      "Código externo": "",
      "Código externo adicional": "",
      Carteira: cap(p.unidade_cliente),
    } as Record<string, any>;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: COLUNAS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `cadastro_processos_em_lote_${stamp}.xlsx`);
  return rows.length;
}
