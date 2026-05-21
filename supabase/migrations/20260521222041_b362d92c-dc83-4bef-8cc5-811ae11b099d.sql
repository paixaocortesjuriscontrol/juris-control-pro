
ALTER TABLE public.publicacoes_djen           ADD COLUMN IF NOT EXISTS id_djen text;
ALTER TABLE public.publicacoes_djen_descartadas ADD COLUMN IF NOT EXISTS id_djen text;
ALTER TABLE public.publicacoes_djen_processos ADD COLUMN IF NOT EXISTS id_djen text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pub_djen_coord_iddjen
  ON public.publicacoes_djen (coordenacao_id, id_djen)
  WHERE id_djen IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pub_djenp_coord_iddjen
  ON public.publicacoes_djen_processos (coordenacao_id, id_djen)
  WHERE id_djen IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_iddjen
  ON public.publicacoes_djen_descartadas (coordenacao_id, id_djen)
  WHERE id_djen IS NOT NULL;

-- Backfill via índice diário (match por conteúdo + data)
UPDATE public.publicacoes_djen p
SET id_djen = (d.raw_json->>'id')
FROM public.djen_diario_publicacoes d
WHERE p.id_djen IS NULL
  AND d.raw_json ? 'id'
  AND p.conteudo = d.conteudo
  AND p.data_disponibilizacao IS NOT DISTINCT FROM d.data_disponibilizacao;

UPDATE public.publicacoes_djen_descartadas p
SET id_djen = (d.raw_json->>'id')
FROM public.djen_diario_publicacoes d
WHERE p.id_djen IS NULL
  AND d.raw_json ? 'id'
  AND p.conteudo = d.conteudo
  AND p.data_disponibilizacao IS NOT DISTINCT FROM d.data_disponibilizacao;

-- Remove duplicatas para não violar índice único
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY coordenacao_id, id_djen ORDER BY created_at ASC, id ASC) AS rn
  FROM public.publicacoes_djen WHERE id_djen IS NOT NULL
)
DELETE FROM public.publicacoes_djen WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY coordenacao_id, id_djen ORDER BY created_at ASC, id ASC) AS rn
  FROM public.publicacoes_djen_processos WHERE id_djen IS NOT NULL
)
DELETE FROM public.publicacoes_djen_processos WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE OR REPLACE FUNCTION public.mark_djen_duplicada_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.coordenacao_id IS NULL AND NEW.monitoramento_id IS NOT NULL THEN
    SELECT md.coordenacao_id INTO NEW.coordenacao_id
    FROM public.monitoramentos_djen md WHERE md.id = NEW.monitoramento_id;
  END IF;

  NEW.dedup_key := public.compute_djen_dedup_key(
    NEW.coordenacao_id, NEW.processo_numero,
    NEW.data_disponibilizacao, NEW.data_publicacao, COALESCE(NEW.created_at, now())
  );
  NEW.dedup_processo_digits := regexp_replace(COALESCE(NEW.processo_numero, ''), '[^0-9]', '', 'g');
  NEW.dedup_data_ref := COALESCE(NEW.data_disponibilizacao::date, NEW.data_publicacao::date, COALESCE(NEW.created_at, now())::date);
  NEW.dedup_head_norm := left(lower(regexp_replace(regexp_replace(regexp_replace(
    COALESCE(public.strip_destinatarios(NEW.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300);

  IF NEW.status = 'descartada'::djen_status THEN RETURN NEW; END IF;

  IF NEW.id_djen IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.publicacoes_djen pd
      WHERE pd.id <> NEW.id
        AND pd.coordenacao_id IS NOT DISTINCT FROM NEW.coordenacao_id
        AND pd.id_djen = NEW.id_djen
    ) THEN
      NEW.status := 'duplicada'::djen_status;
    ELSE
      NEW.status := 'encontrada'::djen_status;
    END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.publicacoes_djen pd
    WHERE pd.status = 'encontrada'::djen_status
      AND pd.id <> NEW.id
      AND pd.coordenacao_id IS NOT DISTINCT FROM NEW.coordenacao_id
      AND pd.dedup_processo_digits IS NOT DISTINCT FROM NEW.dedup_processo_digits
      AND pd.dedup_data_ref IS NOT DISTINCT FROM NEW.dedup_data_ref
      AND pd.dedup_head_norm IS NOT DISTINCT FROM NEW.dedup_head_norm
  ) THEN
    NEW.status := 'duplicada'::djen_status;
  ELSE
    NEW.status := 'encontrada'::djen_status;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_djenp_duplicada_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.coordenacao_id IS NULL AND NEW.processo_id IS NOT NULL THEN
    SELECT p.coordenacao_id INTO NEW.coordenacao_id
    FROM public.processos p WHERE p.id = NEW.processo_id;
  END IF;

  NEW.dedup_key := public.compute_djen_dedup_key(
    NEW.coordenacao_id, NEW.processo_numero,
    NEW.data_disponibilizacao, NEW.data_publicacao, COALESCE(NEW.created_at, now())
  );
  NEW.dedup_processo_digits := regexp_replace(COALESCE(NEW.processo_numero, ''), '[^0-9]', '', 'g');
  NEW.dedup_data_ref := COALESCE(NEW.data_disponibilizacao::date, NEW.data_publicacao::date, COALESCE(NEW.created_at, now())::date);
  NEW.dedup_head_norm := left(lower(regexp_replace(regexp_replace(regexp_replace(
    COALESCE(public.strip_destinatarios(NEW.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300);

  IF NEW.status = 'descartada'::djen_status THEN RETURN NEW; END IF;

  IF NEW.id_djen IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.publicacoes_djen_processos pdp
      WHERE pdp.id <> NEW.id
        AND pdp.coordenacao_id IS NOT DISTINCT FROM NEW.coordenacao_id
        AND pdp.id_djen = NEW.id_djen
    ) THEN
      NEW.status := 'duplicada'::djen_status;
    ELSE
      NEW.status := 'encontrada'::djen_status;
    END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.publicacoes_djen_processos pdp
    WHERE pdp.status = 'encontrada'::djen_status
      AND pdp.id <> NEW.id
      AND pdp.coordenacao_id IS NOT DISTINCT FROM NEW.coordenacao_id
      AND pdp.dedup_processo_digits IS NOT DISTINCT FROM NEW.dedup_processo_digits
      AND pdp.dedup_data_ref IS NOT DISTINCT FROM NEW.dedup_data_ref
      AND pdp.dedup_head_norm IS NOT DISTINCT FROM NEW.dedup_head_norm
  ) THEN
    NEW.status := 'duplicada'::djen_status;
  ELSE
    NEW.status := 'encontrada'::djen_status;
  END IF;

  RETURN NEW;
END;
$function$;

-- Reclassificação dos últimos 7 dias com id_djen
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY coordenacao_id, id_djen ORDER BY created_at ASC, id ASC) AS rn
  FROM public.publicacoes_djen
  WHERE id_djen IS NOT NULL
    AND created_at >= now() - interval '7 days'
    AND status IN ('encontrada'::djen_status, 'duplicada'::djen_status)
)
UPDATE public.publicacoes_djen p
SET status = CASE WHEN r.rn = 1 THEN 'encontrada'::djen_status ELSE 'duplicada'::djen_status END
FROM ranked r WHERE p.id = r.id;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY coordenacao_id, id_djen ORDER BY created_at ASC, id ASC) AS rn
  FROM public.publicacoes_djen_processos
  WHERE id_djen IS NOT NULL
    AND created_at >= now() - interval '7 days'
    AND status IN ('encontrada'::djen_status, 'duplicada'::djen_status)
)
UPDATE public.publicacoes_djen_processos p
SET status = CASE WHEN r.rn = 1 THEN 'encontrada'::djen_status ELSE 'duplicada'::djen_status END
FROM ranked r WHERE p.id = r.id;
