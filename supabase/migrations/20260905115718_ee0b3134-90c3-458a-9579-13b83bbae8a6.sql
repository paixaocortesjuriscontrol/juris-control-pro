ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS tem_materias_dossie boolean NOT NULL DEFAULT false;

UPDATE public.dados_benner db
SET tem_materias_dossie = true
WHERE db.dossie IS NOT NULL AND db.dossie <> ''
  AND EXISTS (SELECT 1 FROM public.pedidos_por_dossie pd WHERE pd.dossie = db.dossie)
  AND db.tem_materias_dossie IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_dados_benner_tem_materias_dossie
  ON public.dados_benner (tem_materias_dossie);

CREATE OR REPLACE FUNCTION public.set_tem_materias_dossie()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.tem_materias_dossie := (
    NEW.dossie IS NOT NULL AND NEW.dossie <> ''
    AND EXISTS (SELECT 1 FROM public.pedidos_por_dossie pd WHERE pd.dossie = NEW.dossie)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dados_benner_tem_materias_dossie ON public.dados_benner;
CREATE TRIGGER trg_dados_benner_tem_materias_dossie
BEFORE INSERT OR UPDATE OF dossie ON public.dados_benner
FOR EACH ROW EXECUTE FUNCTION public.set_tem_materias_dossie();

CREATE OR REPLACE FUNCTION public.sync_tem_materias_dossie()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d text;
  v boolean;
BEGIN
  FOREACH d IN ARRAY ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.dossie END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.dossie END
    ]) x WHERE x IS NOT NULL AND x <> ''
  )
  LOOP
    SELECT EXISTS (SELECT 1 FROM public.pedidos_por_dossie pd WHERE pd.dossie = d) INTO v;
    UPDATE public.dados_benner db
    SET tem_materias_dossie = v
    WHERE db.dossie = d
      AND db.tem_materias_dossie IS DISTINCT FROM v;
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_por_dossie_sync ON public.pedidos_por_dossie;
CREATE TRIGGER trg_pedidos_por_dossie_sync
AFTER INSERT OR UPDATE OF dossie OR DELETE ON public.pedidos_por_dossie
FOR EACH ROW EXECUTE FUNCTION public.sync_tem_materias_dossie();

CREATE OR REPLACE FUNCTION public.tem_pedidos_dossie(db public.dados_benner)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(db.tem_materias_dossie, false)
$$;

GRANT EXECUTE ON FUNCTION public.tem_pedidos_dossie(public.dados_benner) TO authenticated;

DO $mig$
DECLARE
  f record;
  def text;
  novo text;
BEGIN
  FOR f IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosrc LIKE '%pedidos_por_dossie pd WHERE pd.dossie = db.dossie%'
  LOOP
    def := pg_get_functiondef(f.oid);
    novo := regexp_replace(
      def,
      'EXISTS \(\s*SELECT 1 FROM public\.pedidos_por_dossie pd WHERE pd\.dossie = db\.dossie\)',
      'db.tem_materias_dossie',
      'g'
    );
    IF novo <> def THEN
      EXECUTE novo;
    END IF;
  END LOOP;
END
$mig$;