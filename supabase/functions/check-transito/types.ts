export type TribunalCode = "tst" | `trt${number}`;

/**
 * transitado            → trânsito confirmado, sem movimentações que reabram o processo
 * transitado_execucao   → trânsito confirmado, mas fase executória em andamento
 * ativo                 → sem trânsito detectado OU recurso posterior identificado
 * inconclusivo          → dados insuficientes para decidir
 */
export type StatusTransito =
  | "transitado"
  | "transitado_execucao"
  | "ativo"
  | "inconclusivo";

export interface Movimentacao {
  codigo: number;
  nome: string;
  /** ISO 8601 string retornado pelo DataJud */
  dataHora: string;
  complemento?: string;
}

export interface ConsultaProcesso {
  numeroProcesso: string;
  movimentacoes: Movimentacao[];
  tribunal: TribunalCode;
}

export type MetodoDeteccao = "codigo_848" | "codigo_22_246" | "texto";

export interface DeteccaoTransito {
  detectado: boolean;
  /** 0–100. Reflete a força da evidência encontrada. */
  confianca: number;
  dataTransito?: Date;
  metodo?: MetodoDeteccao;
  movimentacaoOrigem?: Movimentacao;
}

export interface ClassificacaoMovimentacao {
  movimentacao: Movimentacao;
  categoria: "admin" | "execucao" | "recurso_novo" | "desconhecida";
}

export interface AnalisePosTransito {
  temRecursoPosterior: boolean;
  temExecucaoAtiva: boolean;
  movimentacoesClassificadas: ClassificacaoMovimentacao[];
}

export interface ResultadoTribunal {
  tribunal: TribunalCode;
  status: StatusTransito;
  confianca: number;
  dataTransito?: Date;
  analisePos?: AnalisePosTransito;
  erro?: string;
}

export interface ResultadoFinal {
  numeroProcesso: string;
  status: StatusTransito;
  confianca: number;
  dataTransito?: string;
  fonteDados: string;
  nota: string;
  detalhes: {
    tst?: ResultadoTribunal;
    trt?: ResultadoTribunal;
    reconciliacao: string;
  };
}
