import * as XLSX from "xlsx";

// Generate and download a template Excel file
export function downloadTemplateExcel(columns: string[], sheetName: string, fileName: string) {
  // Create empty rows with headers
  const ws = XLSX.utils.aoa_to_sheet([columns]);
  
  // Set column widths
  ws['!cols'] = columns.map(() => ({ wch: 20 }));
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  XLSX.writeFile(wb, fileName);
}

// Template definitions for each import type
export const TEMPLATES = {
  projuris: {
    columns: [
      "Número CNJ", "Assunto", "Situação", "Órgão", "Órgão julgador", 
      "Área", "Data distribuição", "Valor ação", "Partes ativas", 
      "Partes passivas", "Estado", "Cidade", "Clientes"
    ],
    sheetName: "Processos Projuris",
    fileName: "MODELO_IMPORTACAO_PROJURIS.xlsx"
  },
  osmar: {
    columns: [
      "ADVOGADO", "UNIDADE", "Sigla", "Controladora / Consolidado", 
      "Parte Contrária", "CPF / CNPJ", "Distribuição", "Numero do processo",
      "Fase do Processo", "VARA", "PEDIDOS", "FUNÇÃO", "ANDAMENTO", 
      "Esfera", "Natureza", "Matéria", "3º", "Estado", "STATUS DO PROCESSO",
      "Provável", "Possível", "Remoto", "Valor do pagamento", "Valor pago",
      "Depósito judicial", "Observações"
    ],
    sheetName: "Dr. Osmar - Rede D'Or",
    fileName: "MODELO_IMPORTACAO_DR_OSMAR.xlsx"
  },
  janaina: {
    columns: [
      "Processo Judicial", "Status", "Comarca", "Vara", "Data do Ajuizamento",
      "Ativo/Passivo", "Reclamante", "Reclamados", "Natureza", "Desligamento",
      "Responsabilidade", "Assunto da Ação", "Pedido e Valor", "Andamento",
      "Data da Consulta", "Período da Condenação", "Risco Perda", "Justificativa",
      "Valor da Causa", "Valor Perda", "Valor da Condenação", "Depósitos vinculados",
      "Função", "Advogado", "Setor"
    ],
    sheetName: "Dra. Janaína - ACH",
    fileName: "MODELO_IMPORTACAO_DRA_JANAINA.xlsx"
  },
  polyana: {
    columns: [
      "HOSPITAL", "Parte Contrária", "Numero do processo", "Fase do Processo",
      "DESCRIÇÃO DO OBJETO", "ANDAMENTO ATUALIZADO", "VALOR DA CAUSA"
    ],
    sheetName: "Dra. Polyana",
    fileName: "MODELO_IMPORTACAO_DRA_POLYANA.xlsx"
  },
  mpt: {
    columns: [
      "PROCEDIMENTO", "LOCALIDADE", "UF", "AUTOR", "REQUERIDO", 
      "MATÉRIA", "ÚLTIMO ANDAMENTO", "STATUS", "Observação Advogado Responsável"
    ],
    sheetName: "Ministério Público",
    fileName: "MODELO_IMPORTACAO_MPT.xlsx"
  },
  pedidos: {
    columns: [
      "PROCESSO", "RECLAMANTE", "FUNÇÃO", "SETOR", "RECLAMADO", "VARA", "COMARCA",
      "Lei 13.467/2017", "Responsabilidade Subsidiária",
      "Excesso de Jornada", "Plantões Extras", "Dobras", 
      "Intervalo Intrajornada", "Intervalo Interjornada", "Descaracterização 12x36",
      "Domingos/Feriados", "Insalubridade/Periculosidade", "Diferenças Salariais",
      "Adicional Noturno", "Sobrecarga de Trabalho", "Reconhecimento de Vínculo",
      "Danos Morais Assédio", "Danos Morais Outros", "Danos Morais Acidente",
      "Danos Materiais", "Acidente/Doença Ocupacional", "Pensão Vitalícia",
      "Limbo Previdenciário", "Estabilidade", "Reversão Justa Causa",
      "Reversão Pedido Demissão", "Rescisão Indireta", "Indenização Substitutiva",
      "Multas CLT", "Multas CCTs", "Status", "Motivo Encerramento", "Custo Encerramento"
    ],
    sheetName: "Pedidos Trabalhistas",
    fileName: "MODELO_IMPORTACAO_PEDIDOS.xlsx"
  }
};

export function downloadProjurisTemplate() {
  downloadTemplateExcel(TEMPLATES.projuris.columns, TEMPLATES.projuris.sheetName, TEMPLATES.projuris.fileName);
}

export function downloadOsmarTemplate() {
  downloadTemplateExcel(TEMPLATES.osmar.columns, TEMPLATES.osmar.sheetName, TEMPLATES.osmar.fileName);
}

export function downloadJanainaTemplate() {
  downloadTemplateExcel(TEMPLATES.janaina.columns, TEMPLATES.janaina.sheetName, TEMPLATES.janaina.fileName);
}

export function downloadPolyanaTemplate() {
  downloadTemplateExcel(TEMPLATES.polyana.columns, TEMPLATES.polyana.sheetName, TEMPLATES.polyana.fileName);
}

export function downloadMptTemplate() {
  downloadTemplateExcel(TEMPLATES.mpt.columns, TEMPLATES.mpt.sheetName, TEMPLATES.mpt.fileName);
}

export function downloadPedidosTemplate() {
  downloadTemplateExcel(TEMPLATES.pedidos.columns, TEMPLATES.pedidos.sheetName, TEMPLATES.pedidos.fileName);
}
