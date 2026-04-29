
-- ETAPA 1/4 — Schema + função utilitária + trigger (sem backfill pesado)
DO $$ BEGIN
  CREATE TYPE public.djen_status AS ENUM ('encontrada', 'descartada', 'duplicada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.publicacoes_djen
  ADD COLUMN IF NOT EXISTS status public.djen_status NOT NULL DEFAULT 'encontrada',
  ADD COLUMN IF NOT EXISTS dedup_key text;

ALTER TABLE public.publicacoes_djen_processos
  ADD COLUMN IF NOT EXISTS status public.djen_status NOT NULL DEFAULT 'encontrada',
  ADD COLUMN IF NOT EXISTS dedup_key text;

CREATE OR REPLACE FUNCTION public.compute_djen_dedup_key(
  p_coordenacao uuid, p_processo_numero text,
  p_data_disp timestamptz, p_data_pub timestamptz, p_created_at timestamptz
) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(p_coordenacao::text,'') || '|' ||
         regexp_replace(coalesce(p_processo_numero,''),'[^0-9]','','g') || '|' ||
         coalesce(
           to_char(p_data_disp::date,'YYYY-MM-DD'),
           to_char(p_data_pub::date,'YYYY-MM-DD'),
           to_char(coalesce(p_created_at, now())::date,'YYYY-MM-DD')
         );
$$;

CREATE OR REPLACE FUNCTION public.mark_djen_duplicada_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.coordenacao_id IS NULL AND NEW.monitoramento_id IS NOT NULL THEN
    SELECT md.coordenacao_id INTO NEW.coordenacao_id
    FROM public.monitoramentos_djen md WHERE md.id = NEW.monitoramento_id;
  END IF;
  NEW.dedup_key := public.compute_djen_dedup_key(
    NEW.coordenacao_id, NEW.processo_numero,
    NEW.data_disponibilizacao, NEW.data_publicacao, COALESCE(NEW.created_at, now())
  );
  IF NEW.status = 'descartada' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.publicacoes_djen
    WHERE dedup_key = NEW.dedup_key AND status = 'encontrada' AND id <> NEW.id
  ) THEN
    NEW.status := 'duplicada';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_djenp_duplicada_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.coordenacao_id IS NULL AND NEW.processo_id IS NOT NULL THEN
    SELECT p.coordenacao_id INTO NEW.coordenacao_id
    FROM public.processos p WHERE p.id = NEW.processo_id;
  END IF;
  NEW.dedup_key := public.compute_djen_dedup_key(
    NEW.coordenacao_id, NEW.processo_numero,
    NEW.data_disponibilizacao, NEW.data_publicacao, COALESCE(NEW.created_at, now())
  );
  IF NEW.status = 'descartada' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.publicacoes_djen_processos
    WHERE dedup_key = NEW.dedup_key AND status = 'encontrada' AND id <> NEW.id
  ) THEN
    NEW.status := 'duplicada';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_djen_mark_duplicada ON public.publicacoes_djen;
CREATE TRIGGER trg_djen_mark_duplicada
  BEFORE INSERT ON public.publicacoes_djen
  FOR EACH ROW EXECUTE FUNCTION public.mark_djen_duplicada_on_insert();

DROP TRIGGER IF EXISTS trg_djenp_mark_duplicada ON public.publicacoes_djen_processos;
CREATE TRIGGER trg_djenp_mark_duplicada
  BEFORE INSERT ON public.publicacoes_djen_processos
  FOR EACH ROW EXECUTE FUNCTION public.mark_djenp_duplicada_on_insert();
