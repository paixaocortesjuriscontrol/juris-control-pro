/**
 * Catálogo de pedidos trabalhistas (baseado no Relatório Analítico de Pedidos).
 * Usado na aba Pedidos de Processos e Casos para seleção rápida.
 */
export interface GrupoPedidos {
  grupo: string;
  pedidos: string[];
}

export const CATALOGO_PEDIDOS_TRABALHISTAS: GrupoPedidos[] = [
  {
    grupo: "Contrato de Trabalho",
    pedidos: ["Lei 13.467/2017", "Responsabilidade subsidiária", "Reconhecimento de vínculo"],
  },
  {
    grupo: "Horas Extras",
    pedidos: [
      "Excesso de jornada",
      "Plantões extras",
      "Dobras",
      "Intervalo intrajornada",
      "Intervalo interjornada",
      "Descaracterização jornada 12x36",
      "Domingos/Feriados",
    ],
  },
  {
    grupo: "Adicionais e Diferenças",
    pedidos: [
      "Insalubridade/Periculosidade",
      "Diferenças salariais",
      "Adicional noturno",
      "Sobrecarga de trabalho",
    ],
  },
  {
    grupo: "Danos Morais",
    pedidos: ["Danos morais - Assédio", "Danos morais - Outros"],
  },
  {
    grupo: "Acidente de Trabalho / Doença Ocupacional",
    pedidos: [
      "Acidente/Doença ocupacional",
      "Danos materiais",
      "Pensão vitalícia",
      "Danos morais (acidente/doença)",
      "Limbo previdenciário",
    ],
  },
  {
    grupo: "Rescisão e Estabilidade",
    pedidos: [
      "Estabilidade",
      "Indenização substitutiva",
      "Reversão de justa causa",
      "Rescisão indireta",
      "Reversão de pedido de demissão",
    ],
  },
  {
    grupo: "Multas",
    pedidos: ["Multas CLT", "Multas CCTs"],
  },
];

export const TODOS_PEDIDOS_TRABALHISTAS = CATALOGO_PEDIDOS_TRABALHISTAS.flatMap((g) => g.pedidos);
