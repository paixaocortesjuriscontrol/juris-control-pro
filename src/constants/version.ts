// Versão do sistema - atualizar a cada release
export const APP_VERSION = "4.4.2";

// Changelog resumido (opcional, para referência interna)
export const VERSION_HISTORY = [
  { version: "1.0.0", date: "2026-01-30", notes: "Versão inicial com versionamento" },
  { version: "1.0.1", date: "2026-01-30", notes: "Correções no dashboard DJEN (destravamento/execução)" },
  { version: "1.0.2", date: "2026-01-31", notes: "Correção validação OAB+nome para advogados DJEN" },
  { version: "1.0.3", date: "2026-01-31", notes: "Reversão para modelo sequencial simples - progresso funcional" },
  { version: "1.0.4", date: "2026-01-31", notes: "Sistema de checkpoint e retomada de execução" },
  { version: "1.0.5", date: "2026-01-31", notes: "Otimização de performance - delays reduzidos, loop simplificado" },
  { version: "1.0.6", date: "2026-01-31", notes: "Contagem DJEN deduplicada - consistência Card x Análise" },
  { version: "1.0.7", date: "2026-05-01", notes: "Sincronização Dra. Janaina Completa como fonte de verdade" },
  { version: "1.0.8", date: "2026-05-04", notes: "Comentários de coordenação em publicações DJEN (UI + relatórios PDF/DOC)" },
  { version: "2.0", date: "2026-05-29", notes: "Marco 2.0: auto-save por aba, controles de acesso refinados em Distribuição TST" },
  { version: "2.1", date: "2026-06-12", notes: "Tags de status (Problema Judit, Segredo, Recurso de terceiro, CEJUSC) na lista de Distribuição TST" },
  { version: "2.2", date: "2026-06-12", notes: "Cards de stats unificados em Distribuição TST (Benner, Judit, Equipe, Dossiês)" },
  { version: "4.3.0", date: "2026-07-28", notes: "Correção das permissões de comentários em prazos/tarefas e audiências" },
  { version: "4.3.1", date: "2026-07-28", notes: "Painel da Equipe compacto e melhorias na visão de itens por membro" },
  { version: "4.3.2", date: "2026-07-29", notes: "Contador de mensagens não lidas ao lado da versão e no botão Alertas" },
  { version: "4.3.3", date: "2026-07-31", notes: "Etiquetas por coordenação em Clientes, Processos, Itens e Publicações" },
  { version: "4.3.4", date: "2026-08-03", notes: "Auditoria da Distribuição TST e normalização de Recorrente (Terceiro → Outra) na Carga Benner" },
  { version: "4.3.5", date: "2026-08-04", notes: "Cards compactos no Painel de Controle, correção do salvamento de audiências e alertas de prazos perdidos ignorando itens encerrados" },
  { version: "4.3.6", date: "2026-08-04", notes: "Lista lateral de atividades do dia no calendário do Painel de Controle (estilo Astrea)" },
  { version: "4.3.7", date: "2026-08-04", notes: "Exportação por período/tipos, filtros com botão Filtrar e digitação livre de datas" },
  { version: "4.3.8", date: "2026-08-05", notes: "Alerta por e-mail quando uma execução do DJEN Termos encontra mais publicações que a execução anterior do dia (BRT)" },
  { version: "4.3.9", date: "2026-08-06", notes: "Indicadores: filtros por coordenação, usuário e período (últimos 12 meses, ano específico ou todos os anos)" },
  { version: "4.4.0", date: "2026-08-06", notes: "Distribuição TST: seleção por quantidade (1 até o total filtrado) na lista" },
  { version: "4.4.1", date: "2026-08-07", notes: "Análise DJEN: Salvar e ler marca o grupo corretamente, data base da publicação e coordenador fixo como envolvido" },
  { version: "4.4.2", date: "2026-08-09", notes: "Acompanhamento Especial: sincronização automática Judit (partes, andamentos, análise) e card de divergências no painel" },
];
