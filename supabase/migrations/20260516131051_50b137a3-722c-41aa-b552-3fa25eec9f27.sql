DELETE FROM public.publicacoes_djen
WHERE coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5'::uuid
  AND data_disponibilizacao >= '2026-05-14T00:00:00Z'::timestamptz
  AND data_disponibilizacao <  '2026-05-15T00:00:00Z'::timestamptz;