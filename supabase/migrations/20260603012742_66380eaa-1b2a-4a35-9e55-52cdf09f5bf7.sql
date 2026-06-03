CREATE UNIQUE INDEX IF NOT EXISTS idx_publicacoes_djen_coord_id_djen_unique
ON public.publicacoes_djen (COALESCE(coordenacao_id, '00000000-0000-0000-0000-000000000000'::uuid), id_djen)
WHERE id_djen IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mark_djen_duplicada_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.coordenacao_id IS NULL AND NEW.monitoramento_id IS NOT NULL THEN
    SELECT md.coordenacao_id INTO NEW.coordenacao_id
    FROM public.monitoramentos_djen md
    WHERE md.id = NEW.monitoramento_id;
  END IF;

  NEW.dedup_key := public.compute_djen_dedup_key(
    NEW.coordenacao_id,
    NEW.processo_numero,
    NEW.data_disponibilizacao,
    NEW.data_publicacao,
    COALESCE(NEW.created_at, now())
  );
  NEW.dedup_processo_digits := regexp_replace(COALESCE(NEW.processo_numero, ''), '[^0-9]', '', 'g');
  NEW.dedup_data_ref := COALESCE(NEW.data_disponibilizacao::date, NEW.data_publicacao::date, COALESCE(NEW.created_at, now())::date);
  NEW.dedup_head_norm := left(lower(regexp_replace(regexp_replace(regexp_replace(
    COALESCE(public.strip_destinatarios(NEW.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300);

  IF NEW.status = 'descartada'::djen_status THEN
    RETURN NEW;
  END IF;

  IF NEW.id_djen IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.publicacoes_djen pd
      WHERE pd.id <> NEW.id
        AND pd.id_djen = NEW.id_djen
        AND COALESCE(pd.coordenacao_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(NEW.coordenacao_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      NEW.status := 'duplicada'::djen_status;
    ELSE
      NEW.status := 'encontrada'::djen_status;
    END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.publicacoes_djen pd
    WHERE pd.status = 'encontrada'::djen_status
      AND pd.id <> NEW.id
      AND COALESCE(pd.coordenacao_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(NEW.coordenacao_id, '00000000-0000-0000-0000-000000000000'::uuid)
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