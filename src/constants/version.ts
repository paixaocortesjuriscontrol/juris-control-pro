// Versão do sistema - atualizar a cada release
export const APP_VERSION = "2.2";

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
];
