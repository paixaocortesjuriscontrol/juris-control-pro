// Tipos para progresso detalhado do DJEN

export type TipoTermo = 'advogado' | 'palavra-chave' | 'processo';
export type StatusFase = 'pendente' | 'executando' | 'concluido' | 'erro';

export interface FaseTermo {
  total: number;
  processados: number;
  status: StatusFase;
  termoAtual?: string;
}

export interface ProgressoCoordenacao {
  coordenacaoId: string;
  coordenacaoNome: string;
  status: StatusFase;
  advogados: FaseTermo;
  palavrasChave: FaseTermo;
  processos: FaseTermo;
  novas: number;
  duplicadas: number;
}

// Grupo de monitoramentos por coordenação e tipo
export interface GrupoCoordenacao {
  coordenacao: { 
    id: string; 
    nome: string;
  };
  advogados: MonitoramentoDjenBasico[];
  palavrasChave: MonitoramentoDjenBasico[];
  processos: MonitoramentoDjenBasico[];
}

export interface MonitoramentoDjenBasico {
  id: string;
  tipo: 'palavra-chave' | 'advogado' | 'processo' | 'parte';
  termo_busca: string;
  oab?: string;
  uf?: string;
  coordenacao_id?: string;
  ativo: boolean;
  exclusoes?: string[];
  condicao_concomitante?: string;
  tribunais?: string[];
}

// Helper para criar fase padrão
export const criarFasePadrao = (): FaseTermo => ({
  total: 0,
  processados: 0,
  status: 'pendente',
});

// Helper para criar progresso de coordenação
export const criarProgressoCoordenacao = (
  id: string,
  nome: string,
  advogadosTotal: number,
  termosTotal: number,
  processosTotal: number
): ProgressoCoordenacao => ({
  coordenacaoId: id,
  coordenacaoNome: nome,
  status: 'pendente',
  advogados: { ...criarFasePadrao(), total: advogadosTotal },
  palavrasChave: { ...criarFasePadrao(), total: termosTotal },
  processos: { ...criarFasePadrao(), total: processosTotal },
  novas: 0,
  duplicadas: 0,
});
