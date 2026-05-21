DELETE FROM publicacoes_djen_descartadas d
USING monitoramentos_djen m
WHERE d.monitoramento_id = m.id
  AND m.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND d.data_publicacao::date = '2026-05-19';