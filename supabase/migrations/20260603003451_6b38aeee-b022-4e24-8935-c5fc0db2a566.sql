WITH alvo AS (
  SELECT pd.id, pd.hash_conteudo, pd.data_disponibilizacao, pd.conteudo
  FROM public.publicacoes_djen pd
  JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
  WHERE md.coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
    AND pd.data_disponibilizacao::date IN ('2026-06-01','2026-06-02')
)
DELETE FROM public.publicacoes_djen_global_hash gh
USING alvo a
WHERE gh.publicacao_id = a.id
   OR (gh.escopo_dedup = 'coord:3e47fc83-3539-4fa7-9fcf-33825120e1b7');

DELETE FROM public.publicacoes_djen pd
USING public.monitoramentos_djen md
WHERE md.id = pd.monitoramento_id
  AND md.coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
  AND pd.data_disponibilizacao::date IN ('2026-06-01','2026-06-02');