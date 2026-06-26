-- Remove órfãos antes de criar as FKs
DELETE FROM public.publicacoes_djen_execucoes je
WHERE NOT EXISTS (SELECT 1 FROM public.publicacoes_djen p WHERE p.id = je.publicacao_id);

DELETE FROM public.publicacoes_djen_execucoes je
WHERE NOT EXISTS (SELECT 1 FROM public.execucoes_agendadas e WHERE e.id = je.execucao_id);

ALTER TABLE public.publicacoes_djen_execucoes
  ADD CONSTRAINT publicacoes_djen_execucoes_publicacao_fk
  FOREIGN KEY (publicacao_id) REFERENCES public.publicacoes_djen(id) ON DELETE CASCADE;

ALTER TABLE public.publicacoes_djen_execucoes
  ADD CONSTRAINT publicacoes_djen_execucoes_execucao_fk
  FOREIGN KEY (execucao_id) REFERENCES public.execucoes_agendadas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pde_execucao_id ON public.publicacoes_djen_execucoes(execucao_id);
CREATE INDEX IF NOT EXISTS idx_pde_publicacao_id ON public.publicacoes_djen_execucoes(publicacao_id);