CREATE OR REPLACE FUNCTION public.set_pub_djen_descartada_coordenacao_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.monitoramento_id IS NOT NULL
     AND (NEW.coordenacao_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.monitoramento_id IS DISTINCT FROM OLD.monitoramento_id)) THEN
    SELECT md.coordenacao_id
      INTO NEW.coordenacao_id
    FROM public.monitoramentos_djen md
    WHERE md.id = NEW.monitoramento_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_pub_djen_descartada_coord ON public.publicacoes_djen_descartadas;
CREATE TRIGGER trg_set_pub_djen_descartada_coord
BEFORE INSERT OR UPDATE ON public.publicacoes_djen_descartadas
FOR EACH ROW
EXECUTE FUNCTION public.set_pub_djen_descartada_coordenacao_id();

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_coord_created
ON public.publicacoes_djen_descartadas (coordenacao_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_coord_dedup
ON public.publicacoes_djen_descartadas (coordenacao_id, dedup_processo_digits, dedup_data_ref, dedup_head_norm);