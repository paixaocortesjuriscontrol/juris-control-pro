ALTER TABLE public.execucoes_agendadas DROP CONSTRAINT execucoes_agendadas_tipo_check;

ALTER TABLE public.execucoes_agendadas ADD CONSTRAINT execucoes_agendadas_tipo_check CHECK (tipo = ANY (ARRAY['redistribuicoes'::text, 'andamentos'::text, 'distribuicoes'::text, 'djen'::text, 'djen_processos'::text, 'termos'::text, 'datajud_termos'::text]));