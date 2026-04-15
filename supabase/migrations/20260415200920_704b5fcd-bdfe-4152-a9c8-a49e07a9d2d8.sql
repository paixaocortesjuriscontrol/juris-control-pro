
-- Insert leituras for all publicacoes_djen (termo) from Dr. Thomás's coordination
INSERT INTO public.publicacoes_djen_leituras (publicacao_id, tabela_origem, usuario_id, usuario_nome, lida_em)
SELECT pd.id, 'termo', 'd85dcffc-732d-4ec3-adb7-13b10a5115b7', 'Thomás Rieth', NOW()
FROM public.publicacoes_djen pd
JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
WHERE md.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
ON CONFLICT (publicacao_id, tabela_origem, usuario_id) DO NOTHING;

-- Insert leituras for all publicacoes_djen_processos (processo) from Dr. Thomás's coordination
INSERT INTO public.publicacoes_djen_leituras (publicacao_id, tabela_origem, usuario_id, usuario_nome, lida_em)
SELECT pdp.id, 'processo', 'd85dcffc-732d-4ec3-adb7-13b10a5115b7', 'Thomás Rieth', NOW()
FROM public.publicacoes_djen_processos pdp
JOIN public.processos p ON p.id = pdp.processo_id
WHERE p.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
ON CONFLICT (publicacao_id, tabela_origem, usuario_id) DO NOTHING;
