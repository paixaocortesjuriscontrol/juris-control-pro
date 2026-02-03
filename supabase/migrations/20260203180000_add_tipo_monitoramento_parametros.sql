-- Tipos de monitoramento para parametrização
CREATE TABLE IF NOT EXISTS public.tipo_monitoramento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.tipo_monitoramento (slug, nome)
VALUES
  ('djen_termos', 'DJEN Termos'),
  ('djen_processos', 'DJEN Processos'),
  ('andamentos', 'Andamentos'),
  ('redistribuicoes', 'Redistribuições'),
  ('distribuicoes', 'Distribuições'),
  ('termos_360', 'Monitoração 360')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.tipo_monitoramento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler tipos de monitoramento"
ON public.tipo_monitoramento
FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER update_tipo_monitoramento_updated_at
BEFORE UPDATE ON public.tipo_monitoramento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna de tipo e parâmetros específicos de processos
ALTER TABLE public.parametros_monitoramento_djen
ADD COLUMN IF NOT EXISTS tipo_monitoramento_id uuid,
ADD COLUMN IF NOT EXISTS batch_size integer NOT NULL DEFAULT 50 CHECK (batch_size >= 1 AND batch_size <= 200),
ADD COLUMN IF NOT EXISTS group_search_size integer NOT NULL DEFAULT 50 CHECK (group_search_size >= 1 AND group_search_size <= 200),
ADD COLUMN IF NOT EXISTS delay_entre_lotes integer NOT NULL DEFAULT 3000 CHECK (delay_entre_lotes >= 0 AND delay_entre_lotes <= 20000);

UPDATE public.parametros_monitoramento_djen
SET tipo_monitoramento_id = (
  SELECT id FROM public.tipo_monitoramento WHERE slug = 'djen_termos'
)
WHERE tipo_monitoramento_id IS NULL;

WITH base AS (
  SELECT *
  FROM public.parametros_monitoramento_djen
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO public.parametros_monitoramento_djen (
  tipo_monitoramento_id,
  modo_processamento,
  max_paralelo,
  max_por_invocacao,
  delay_entre_monitoramentos,
  delay_entre_paginas,
  delay_entre_tribunais,
  delay_jina_api,
  soft_timeout_ms,
  finalization_buffer_ms,
  max_retries,
  retry_base_delay_ms,
  batch_size,
  group_search_size,
  delay_entre_lotes,
  descricao,
  ativo
)
SELECT
  t.id,
  b.modo_processamento,
  b.max_paralelo,
  b.max_por_invocacao,
  b.delay_entre_monitoramentos,
  b.delay_entre_paginas,
  b.delay_entre_tribunais,
  b.delay_jina_api,
  b.soft_timeout_ms,
  b.finalization_buffer_ms,
  b.max_retries,
  b.retry_base_delay_ms,
  b.batch_size,
  b.group_search_size,
  b.delay_entre_lotes,
  b.descricao,
  b.ativo
FROM public.tipo_monitoramento t
CROSS JOIN base b
WHERE t.slug IN ('djen_processos', 'andamentos', 'redistribuicoes', 'distribuicoes', 'termos_360')
  AND NOT EXISTS (
    SELECT 1 FROM public.parametros_monitoramento_djen p WHERE p.tipo_monitoramento_id = t.id
  );

ALTER TABLE public.parametros_monitoramento_djen
ALTER COLUMN tipo_monitoramento_id SET NOT NULL;

ALTER TABLE public.parametros_monitoramento_djen
ADD CONSTRAINT parametros_monitoramento_djen_tipo_unique UNIQUE (tipo_monitoramento_id);

ALTER TABLE public.parametros_monitoramento_djen
ADD CONSTRAINT parametros_monitoramento_djen_tipo_fk
FOREIGN KEY (tipo_monitoramento_id) REFERENCES public.tipo_monitoramento(id);
