UPDATE public.publicacoes_djen
SET lida = true
WHERE coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND kurier_login IS NOT NULL
  AND lida = false
  AND data_disponibilizacao < '2026-06-15';