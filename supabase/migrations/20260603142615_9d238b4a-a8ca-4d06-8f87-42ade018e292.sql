-- Marca como lidas por Katarine as publicações de PROCESSOS CADASTRADOS
-- da coordenação do Dr. Thomás com data_disponibilizacao < 02/06/2026.
-- A migração anterior usou IDs da tabela errada (publicacoes_djen) para
-- tabela_origem='processo'. Os IDs corretos vêm de publicacoes_djen_processos.
INSERT INTO public.publicacoes_djen_leituras (publicacao_id, tabela_origem, usuario_id, usuario_nome, lida_em)
SELECT pp.id, 'processo', '8bf8b0a9-bdbd-4be9-82a7-2109261e02c2'::uuid, 'Katarine Dias', now()
FROM public.publicacoes_djen_processos pp
JOIN public.processos pr ON pr.id = pp.processo_id
WHERE pr.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND pp.data_disponibilizacao < '2026-06-02'
  AND NOT EXISTS (
    SELECT 1 FROM public.publicacoes_djen_leituras l
    WHERE l.publicacao_id = pp.id
      AND l.tabela_origem = 'processo'
      AND l.usuario_id = '8bf8b0a9-bdbd-4be9-82a7-2109261e02c2'
  );

-- Também corrige descartadas: IDs vêm de publicacoes_djen_descartadas
INSERT INTO public.publicacoes_djen_leituras (publicacao_id, tabela_origem, usuario_id, usuario_nome, lida_em)
SELECT pd.id, 'descartada', '8bf8b0a9-bdbd-4be9-82a7-2109261e02c2'::uuid, 'Katarine Dias', now()
FROM public.publicacoes_djen_descartadas pd
JOIN public.monitoramentos_djen m ON m.id = pd.monitoramento_id
WHERE m.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND pd.data_disponibilizacao < '2026-06-02'
  AND NOT EXISTS (
    SELECT 1 FROM public.publicacoes_djen_leituras l
    WHERE l.publicacao_id = pd.id
      AND l.tabela_origem = 'descartada'
      AND l.usuario_id = '8bf8b0a9-bdbd-4be9-82a7-2109261e02c2'
  );