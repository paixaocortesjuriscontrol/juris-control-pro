import { dataHoraBrt } from "@/utils/date";

/**
 * Rótulos e formatação usados em TODOS os lugares onde o histórico de
 * alterações aparece: aba "Histórico de alterações" de cada item, tela
 * "Auditoria de Itens" e relatórios PDF/Excel.
 *
 * Os nomes seguem o vocabulário das próprias telas (ex.: data_vencimento é
 * "Data limite" na tela de prazo), para a equipe ler sem precisar conhecer as
 * colunas do banco.
 */
export const LABELS: Record<string, string> = {
  titulo: "Título",
  descricao: "Descrição",
  observacoes: "Observações",
  observacao: "Observação",
  status: "Situação",
  situacao: "Situação",
  prioridade: "Prioridade",
  data_vencimento: "Data limite",
  data_fatal: "Data fatal",
  data_base: "Data base",
  data_prevista: "Data prevista",
  data_cumprimento: "Data de cumprimento",
  data_criacao_projuris: "Data de criação (Projuris)",
  hora_fatal: "Hora fatal",
  tratado_em: "Tratado em",
  responsavel_id: "Responsável",
  responsaveis: "Responsáveis",
  envolvidos: "Envolvidos",
  advogado_id: "Advogado",
  coordenacao_id: "Coordenação",
  processo_id: "Processo",
  cliente_id: "Cliente",
  numero: "Número do processo",
  cliente: "Cliente",
  objeto_acao: "Objeto da ação",
  pedido: "Pedido",
  data_audiencia: "Data da audiência",
  nome_arquivo: "Arquivo",
  data_inicio: "Data de início",
  data_fim: "Data de término",
  tipo: "Tipo",
  tipo_tarefa: "Tipo",
  local: "Local",
  valor: "Valor",
  orgao_julgador: "Órgão julgador",
  comarca: "Comarca",
  vara: "Vara",
  segredo_justica: "Segredo de justiça",
  situacao_original: "Situação original",
  observacoes_processo: "Observações do processo",
  modelo_tarefa_id: "Modelo de tarefa",
  pasta_cliente: "Pasta do cliente",
};

export const labelCampo = (campo: string) =>
  LABELS[campo] || campo.replace(/_/g, " ");

/** Nome de quem fez a ação, lido na frase do histórico. */
export const labelAcao = (acao: string | null | undefined): string => {
  switch (acao) {
    case "criar":
      return "Criou";
    case "atualizar":
      return "Alterou";
    case "deletar":
      return "Excluiu";
    case "erro_criar":
      return "Falha ao criar";
    case "erro_atualizar":
      return "Falha ao alterar";
    case "erro_deletar":
      return "Falha ao excluir";
    default:
      return acao || "alteração";
  }
};

/** De onde veio a gravação (tela, sistema, migração). */
export const labelOrigem = (origem: string | null | undefined): string => {
  if (!origem) return "";
  if (origem.startsWith("db_trigger:tarefas")) return "Tarefas/Prazos (sistema)";
  if (origem.startsWith("db_trigger:eventos_agenda")) return "Agenda (sistema)";
  if (origem.startsWith("db_trigger:processos")) return "Processos (sistema)";
  return origem;
};

/** Valor legível: datas em dd/mm/aaaa, data/hora em Brasília, booleans em Sim/Não. */
export const formatValor = (v: any): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (m) {
    // Só data: mostra como está, sem deslocar fuso. Com hora: converte para BRT.
    if (m[4]) return dataHoraBrt(s);
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
};
