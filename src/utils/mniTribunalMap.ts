/**
 * Mapeamento de tribunais brasileiros para endpoints MNI (Modelo Nacional de Interoperabilidade).
 * 
 * O número CNJ segue o formato: NNNNNNN-DD.AAAA.J.TT.OOOO
 * - J = Justiça (5=Trabalho, 8=Estadual, 4=Federal, 6=Militar, 9=Eleitoral)
 * - TT = Tribunal (01..99)
 * 
 * Cada tribunal expõe seu webservice MNI em /intercomunicacao?wsdl
 */

export interface TribunalMniInfo {
  /** Sigla do tribunal (ex: TRT1, TJDFT) */
  sigla: string;
  /** Nome completo */
  nome: string;
  /** URL base do PJe 1º grau */
  urlBase1Grau: string;
  /** URL base do PJe 2º grau (se disponível) */
  urlBase2Grau?: string;
  /** Endpoint MNI 1º grau */
  mniEndpoint1Grau: string;
  /** Endpoint MNI 2º grau (se disponível) */
  mniEndpoint2Grau?: string;
}

// Justiça do Trabalho (J=5)
const TRIBUNAIS_TRABALHO: Record<string, TribunalMniInfo> = {
  "01": {
    sigla: "TRT1",
    nome: "Tribunal Regional do Trabalho da 1ª Região (RJ)",
    urlBase1Grau: "https://pje.trt1.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt1.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt1.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt1.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "02": {
    sigla: "TRT2",
    nome: "Tribunal Regional do Trabalho da 2ª Região (SP)",
    urlBase1Grau: "https://pje.trt2.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt2.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt2.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt2.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "03": {
    sigla: "TRT3",
    nome: "Tribunal Regional do Trabalho da 3ª Região (MG)",
    urlBase1Grau: "https://pje.trt3.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt3.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt3.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt3.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "04": {
    sigla: "TRT4",
    nome: "Tribunal Regional do Trabalho da 4ª Região (RS)",
    urlBase1Grau: "https://pje.trt4.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt4.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt4.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt4.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "05": {
    sigla: "TRT5",
    nome: "Tribunal Regional do Trabalho da 5ª Região (BA)",
    urlBase1Grau: "https://pje.trt5.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt5.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt5.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt5.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "06": {
    sigla: "TRT6",
    nome: "Tribunal Regional do Trabalho da 6ª Região (PE)",
    urlBase1Grau: "https://pje.trt6.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt6.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt6.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt6.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "07": {
    sigla: "TRT7",
    nome: "Tribunal Regional do Trabalho da 7ª Região (CE)",
    urlBase1Grau: "https://pje.trt7.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt7.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt7.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt7.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "08": {
    sigla: "TRT8",
    nome: "Tribunal Regional do Trabalho da 8ª Região (PA/AP)",
    urlBase1Grau: "https://pje.trt8.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt8.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt8.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt8.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "09": {
    sigla: "TRT9",
    nome: "Tribunal Regional do Trabalho da 9ª Região (PR)",
    urlBase1Grau: "https://pje.trt9.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt9.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt9.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt9.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "10": {
    sigla: "TRT10",
    nome: "Tribunal Regional do Trabalho da 10ª Região (DF/TO)",
    urlBase1Grau: "https://pje.trt10.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt10.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt10.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt10.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "11": {
    sigla: "TRT11",
    nome: "Tribunal Regional do Trabalho da 11ª Região (AM/RR)",
    urlBase1Grau: "https://pje.trt11.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt11.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt11.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt11.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "12": {
    sigla: "TRT12",
    nome: "Tribunal Regional do Trabalho da 12ª Região (SC)",
    urlBase1Grau: "https://pje.trt12.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt12.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt12.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt12.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "13": {
    sigla: "TRT13",
    nome: "Tribunal Regional do Trabalho da 13ª Região (PB)",
    urlBase1Grau: "https://pje.trt13.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt13.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt13.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt13.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "14": {
    sigla: "TRT14",
    nome: "Tribunal Regional do Trabalho da 14ª Região (RO/AC)",
    urlBase1Grau: "https://pje.trt14.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt14.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt14.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt14.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "15": {
    sigla: "TRT15",
    nome: "Tribunal Regional do Trabalho da 15ª Região (Campinas/SP)",
    urlBase1Grau: "https://pje.trt15.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt15.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt15.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt15.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "16": {
    sigla: "TRT16",
    nome: "Tribunal Regional do Trabalho da 16ª Região (MA)",
    urlBase1Grau: "https://pje.trt16.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt16.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt16.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt16.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "17": {
    sigla: "TRT17",
    nome: "Tribunal Regional do Trabalho da 17ª Região (ES)",
    urlBase1Grau: "https://pje.trt17.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt17.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt17.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt17.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "18": {
    sigla: "TRT18",
    nome: "Tribunal Regional do Trabalho da 18ª Região (GO)",
    urlBase1Grau: "https://pje.trt18.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt18.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt18.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt18.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "19": {
    sigla: "TRT19",
    nome: "Tribunal Regional do Trabalho da 19ª Região (AL)",
    urlBase1Grau: "https://pje.trt19.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt19.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt19.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt19.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "20": {
    sigla: "TRT20",
    nome: "Tribunal Regional do Trabalho da 20ª Região (SE)",
    urlBase1Grau: "https://pje.trt20.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt20.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt20.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt20.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "21": {
    sigla: "TRT21",
    nome: "Tribunal Regional do Trabalho da 21ª Região (RN)",
    urlBase1Grau: "https://pje.trt21.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt21.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt21.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt21.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "22": {
    sigla: "TRT22",
    nome: "Tribunal Regional do Trabalho da 22ª Região (PI)",
    urlBase1Grau: "https://pje.trt22.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt22.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt22.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt22.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "23": {
    sigla: "TRT23",
    nome: "Tribunal Regional do Trabalho da 23ª Região (MT)",
    urlBase1Grau: "https://pje.trt23.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt23.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt23.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt23.jus.br/segundograu/intercomunicacao?wsdl",
  },
  "24": {
    sigla: "TRT24",
    nome: "Tribunal Regional do Trabalho da 24ª Região (MS)",
    urlBase1Grau: "https://pje.trt24.jus.br/primeirograu",
    urlBase2Grau: "https://pje.trt24.jus.br/segundograu",
    mniEndpoint1Grau: "https://pje.trt24.jus.br/primeirograu/intercomunicacao?wsdl",
    mniEndpoint2Grau: "https://pje.trt24.jus.br/segundograu/intercomunicacao?wsdl",
  },
};

// Justiça Estadual (J=8) - apenas os que têm PJe com MNI
const TRIBUNAIS_ESTADUAL: Record<string, TribunalMniInfo> = {
  "07": {
    sigla: "TJDFT",
    nome: "Tribunal de Justiça do Distrito Federal e Territórios",
    urlBase1Grau: "https://pje.tjdft.jus.br/pje",
    mniEndpoint1Grau: "https://pje.tjdft.jus.br/pje/intercomunicacao?wsdl",
  },
  "06": {
    sigla: "TJCE",
    nome: "Tribunal de Justiça do Estado do Ceará",
    urlBase1Grau: "https://pje.tjce.jus.br/pje1grau",
    mniEndpoint1Grau: "https://pje.tjce.jus.br/pje1grau/intercomunicacao?wsdl",
  },
  "13": {
    sigla: "TJPB",
    nome: "Tribunal de Justiça do Estado da Paraíba",
    urlBase1Grau: "https://pje.tjpb.jus.br/pje",
    mniEndpoint1Grau: "https://pje.tjpb.jus.br/pje/intercomunicacao?wsdl",
  },
  "17": {
    sigla: "TJES",
    nome: "Tribunal de Justiça do Estado do Espírito Santo",
    urlBase1Grau: "https://pje.tjes.jus.br/pje",
    mniEndpoint1Grau: "https://pje.tjes.jus.br/pje/intercomunicacao?wsdl",
  },
  "20": {
    sigla: "TJSE",
    nome: "Tribunal de Justiça do Estado de Sergipe",
    urlBase1Grau: "https://pje.tjse.jus.br/pje",
    mniEndpoint1Grau: "https://pje.tjse.jus.br/pje/intercomunicacao?wsdl",
  },
  "15": {
    sigla: "TJPB",
    nome: "Tribunal de Justiça do Estado da Paraíba",
    urlBase1Grau: "https://pje.tjpb.jus.br/pje",
    mniEndpoint1Grau: "https://pje.tjpb.jus.br/pje/intercomunicacao?wsdl",
  },
};

/**
 * Extrai os segmentos J (justiça) e TT (tribunal) de um número CNJ.
 * Formato: NNNNNNN-DD.AAAA.J.TT.OOOO
 */
export function extrairJusticaTribunal(numeroCnj: string): { justica: string; tribunal: string } | null {
  // Remove tudo que não é dígito
  const digits = numeroCnj.replace(/\D/g, "");
  
  if (digits.length !== 20) return null;
  
  // Posições no número puro (20 dígitos):
  // NNNNNNN DD AAAA J TT OOOO
  // 0123456 78 9012 3 45 6789
  const justica = digits[13];     // J
  const tribunal = digits.slice(14, 16); // TT
  
  return { justica, tribunal };
}

/**
 * Obtém as informações MNI do tribunal com base no número CNJ do processo.
 */
export function obterTribunalMni(numeroCnj: string): TribunalMniInfo | null {
  const parsed = extrairJusticaTribunal(numeroCnj);
  if (!parsed) return null;
  
  const { justica, tribunal } = parsed;
  
  switch (justica) {
    case "5": // Justiça do Trabalho
      return TRIBUNAIS_TRABALHO[tribunal] || null;
    case "8": // Justiça Estadual
      return TRIBUNAIS_ESTADUAL[tribunal] || null;
    default:
      return null;
  }
}

/**
 * Obtém o endpoint MNI adequado ao grau do processo.
 * Processos com OOOO = "0000" geralmente são 2º grau.
 */
export function obterEndpointMni(numeroCnj: string): string | null {
  const tribunal = obterTribunalMni(numeroCnj);
  if (!tribunal) return null;
  
  const digits = numeroCnj.replace(/\D/g, "");
  const origem = digits.slice(16, 20); // OOOO
  
  // Origem "0000" = 2º grau (recurso)
  if (origem === "0000" && tribunal.mniEndpoint2Grau) {
    return tribunal.mniEndpoint2Grau;
  }
  
  return tribunal.mniEndpoint1Grau;
}

/**
 * Lista todos os tribunais disponíveis no mapeamento MNI.
 */
export function listarTribunaisDisponiveis(): TribunalMniInfo[] {
  return [
    ...Object.values(TRIBUNAIS_TRABALHO),
    ...Object.values(TRIBUNAIS_ESTADUAL),
  ];
}
