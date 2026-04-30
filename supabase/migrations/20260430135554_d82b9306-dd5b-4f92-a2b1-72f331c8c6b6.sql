INSERT INTO public.publicacoes_djen_leituras (publicacao_id, usuario_id, usuario_nome, tabela_origem, lida_em)
SELECT p.id, '8bf8b0a9-bdbd-4be9-82a7-2109261e02c2'::uuid, 'Katarine Dias', 'termo', now()
FROM public.publicacoes_djen p
JOIN public.monitoramentos_djen m ON m.id = p.monitoramento_id
LEFT JOIN public.publicacoes_djen_leituras l 
  ON l.publicacao_id = p.id 
 AND l.usuario_id = '8bf8b0a9-bdbd-4be9-82a7-2109261e02c2'
WHERE m.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date < (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND l.id IS NULL;