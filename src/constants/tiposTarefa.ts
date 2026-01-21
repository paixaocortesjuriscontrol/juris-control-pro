// Tipos de tarefa padronizados usados em todo o sistema
export const TIPOS_TAREFA = [
  "PRAZO",
  "TAREFA EQUIPE",
  "VERIFICAÇÃO",
  "DEFESA",
  "RECURSO",
  "CONTRARRAZÕES",
  "PETIÇÃO",
  "DILIGÊNCIA",
  "AUDIÊNCIA",
  "PROTOCOLO",
  "ANÁLISE",
  "ELABORAÇÃO",
  "SOLICITAÇÃO DE DOCS",
  "MANIFESTAÇÃO",
  "PREPARAÇÃO AUDIÊNCIA",
  "PROVIDÊNCIA",
  "OUTROS"
] as const;

export type TipoTarefa = typeof TIPOS_TAREFA[number];

// Tipos para filtros da agenda (categoria/origem)
export const TIPOS_ORIGEM_AGENDA = [
  "tarefa",
  "evento",
] as const;

export type TipoOrigemAgenda = typeof TIPOS_ORIGEM_AGENDA[number];

// Labels para exibição no filtro
export const TIPOS_TAREFA_LABELS: Record<string, string> = {
  "PRAZO": "Prazo",
  "TAREFA EQUIPE": "Tarefa Equipe",
  "VERIFICAÇÃO": "Verificação",
  "DEFESA": "Defesa",
  "RECURSO": "Recurso",
  "CONTRARRAZÕES": "Contrarrazões",
  "PETIÇÃO": "Petição",
  "DILIGÊNCIA": "Diligência",
  "AUDIÊNCIA": "Audiência",
  "PROTOCOLO": "Protocolo",
  "ANÁLISE": "Análise",
  "ELABORAÇÃO": "Elaboração",
  "SOLICITAÇÃO DE DOCS": "Solicitação de Docs",
  "MANIFESTAÇÃO": "Manifestação",
  "PREPARAÇÃO AUDIÊNCIA": "Preparação Audiência",
  "PROVIDÊNCIA": "Providência",
  "OUTROS": "Outros",
};
