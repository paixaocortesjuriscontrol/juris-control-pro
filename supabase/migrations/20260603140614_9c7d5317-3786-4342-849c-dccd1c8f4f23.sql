INSERT INTO public.publicacoes_djen_leituras (publicacao_id, tabela_origem, usuario_id, usuario_nome, lida_em)
SELECT p.id, 'termo', '8bf8b0a9-bdbd-4be9-82a7-2109261e02c2'::uuid, 'Katarine Dias', now()
FROM public.publicacoes_djen p
WHERE p.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND p.data_disponibilizacao < '2026-06-02'
  AND NOT EXISTS (
    SELECT 1 FROM public.publicacoes_djen_leituras l
    WHERE l.publicacao_id = p.id
      AND l.usuario_id = '8bf8b0a9-bdbd-4be9-82a7-2109261e02c2'
  );