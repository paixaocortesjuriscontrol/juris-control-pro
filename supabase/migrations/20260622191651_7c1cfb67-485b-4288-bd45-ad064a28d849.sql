ALTER TABLE public.distribuicoes_tst_legacy
  RENAME TO distribuicoes_tst_arquivada_2026_06;

COMMENT ON TABLE public.distribuicoes_tst_arquivada_2026_06 IS
  'Arquivada em 2026-06-22. Substituida por dados_benner. Pode ser dropada apos 90 dias sem reclamacoes.';