/** Rótulos em português para os campos auditados da Distribuição TST (dados_benner). */
const LABELS: Record<string, string> = {
  processo: "Processo",
  dossie: "Dossiê",
  equipe: "Equipe",
  coordenacao_id: "Coordenação",
  status: "Status",
  situacao_envio: "Situação de envio",
  benner: "Benner",
  tem_data_julgamento: "Tem data de julgamento",
  data_julgamento: "Data do julgamento",
  horario_julgamento: "Horário do julgamento",
  tipo_julgamento: "Tipo de julgamento",
  entrega_memoriais: "Entrega de memoriais",
  sustentacao_oral: "Sustentação oral",
  relator: "Relator",
  turma: "Turma",
  data_distribuicao: "Data de distribuição",
  tipo_recurso: "Tipo de recurso",
  recurso_reclamante: "Recurso do reclamante",
  recurso_reclamada: "Recurso da reclamada",
  chance_exito: "Chance de êxito",
  chance_exito_reclamante: "Chance de êxito (reclamante)",
  chance_exito_reclamada: "Chance de êxito (reclamada)",
  materias: "Matérias",
  observacoes: "Observações",
  observacao: "Observação",
  outra_materia: "Outra matéria",
  tags: "Tags",
  reclamante: "Reclamante",
  reclamada: "Reclamada",
  valor_causa: "Valor da causa",
  transitado_confirmado: "Trânsito confirmado",
  aba_origem: "Aba de origem",
  outro_escritorio: "Outro escritório",
  processo_id: "Processo (vínculo)",
  created_at: "Criado em",
  updated_at: "Atualizado em",
};

export const labelCampoDistTst = (campo: string): string =>
  LABELS[campo] || campo.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const labelAcaoDistTst = (acao: string): string =>
  ({ criar: "Criado", atualizar: "Alterado", deletar: "Excluído" } as Record<string, string>)[acao] || acao;

export const labelOrigemDistTst = (origem?: string | null): string => {
  if (!origem || origem === "desconhecida") return "Sistema";
  return origem;
};

export const formatValorAuditoria = (v: any): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (m) return m[4] ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : `${m[3]}/${m[2]}/${m[1]}`;
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
};