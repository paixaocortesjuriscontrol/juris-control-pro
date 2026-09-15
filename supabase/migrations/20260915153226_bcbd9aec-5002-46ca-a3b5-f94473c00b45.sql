ALTER TABLE public.dados_benner ADD COLUMN IF NOT EXISTS tag_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_dados_benner_tag_ids ON public.dados_benner USING gin (tag_ids);

CREATE OR REPLACE FUNCTION public.sync_dados_benner_tag_ids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := COALESCE(NEW.dado_benner_id, OLD.dado_benner_id);
  UPDATE public.dados_benner d
     SET tag_ids = COALESCE(
       (SELECT array_agg(t.tag_id) FROM public.dados_benner_processo_tags t WHERE t.dado_benner_id = v_id),
       '{}'
     )
   WHERE d.id = v_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tag_ids ON public.dados_benner_processo_tags;
CREATE TRIGGER trg_sync_tag_ids
AFTER INSERT OR UPDATE OR DELETE ON public.dados_benner_processo_tags
FOR EACH ROW EXECUTE FUNCTION public.sync_dados_benner_tag_ids();

UPDATE public.dados_benner d
   SET tag_ids = sub.ids
  FROM (
    SELECT dado_benner_id, array_agg(tag_id) AS ids
      FROM public.dados_benner_processo_tags
     GROUP BY dado_benner_id
  ) sub
 WHERE d.id = sub.dado_benner_id
   AND d.tag_ids IS DISTINCT FROM sub.ids;