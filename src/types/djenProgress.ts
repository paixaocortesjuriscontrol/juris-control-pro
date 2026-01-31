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

// ============================================================================
// INTERFACE: Grupo de Advogados por OAB (Busca Otimizada)
// ============================================================================
// Agrupa múltiplos monitoramentos de advogado que compartilham a mesma OAB.
// Permite UMA busca na API por OAB, com distribuição inteligente dos resultados
// para cada coordenação/monitoramento, aplicando exclusões específicas.
// ============================================================================
export interface GrupoAdvogado {
  oab: string;                    // Número OAB (apenas dígitos)
  ufsUnificadas: string[];        // Todas UFs de todos os monitoramentos (sem duplicatas)
  nomeParaValidacao: string;      // Nome mais completo para validar conteúdo
  tribunaisUnificados: string[];  // Todos tribunais de todos os monitoramentos
  monitoramentos: GrupoAdvogadoMonitoramento[];
}

export interface GrupoAdvogadoMonitoramento {
  id: string;                     // ID do monitoramento
  coordenacaoId: string;          // ID da coordenação
  coordenacaoNome: string;        // Nome da coordenação (para logs/UI)
  exclusoes: string[];            // Exclusões específicas desta coordenação
  termoOriginal: string;          // Nome do advogado original
  tribunais: string[];            // Tribunais específicos deste monitoramento
  ufs: string[];                  // UFs específicas deste monitoramento
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
