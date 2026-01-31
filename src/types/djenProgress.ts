// Tipos simplificados para progresso DJEN
// Versão 1.0.3 - Modelo sequencial simples

export type TipoTermo = 'advogado' | 'palavra-chave' | 'processo';
export type StatusFase = 'pendente' | 'executando' | 'concluido' | 'erro';

// Interface básica de monitoramento
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
