INSERT INTO public.areas_atuacao (nome, slug, cor, ativo)
VALUES ('Caso', 'caso', '#14B8A6', true)
ON CONFLICT DO NOTHING;

ALTER TABLE public.processos DROP CONSTRAINT IF EXISTS processos_numero_key;

CREATE UNIQUE INDEX IF NOT EXISTS processos_numero_coordenacao_uidx
  ON public.processos (numero, COALESCE(coordenacao_id, '00000000-0000-0000-0000-000000000000'::uuid));