
ALTER TABLE public.publicacoes_djen
  ADD COLUMN IF NOT EXISTS dedup_processo_digits text,
  ADD COLUMN IF NOT EXISTS dedup_data_ref date,
  ADD COLUMN IF NOT EXISTS dedup_head_norm text;

ALTER TABLE public.publicacoes_djen_processos
  ADD COLUMN IF NOT EXISTS dedup_processo_digits text,
  ADD COLUMN IF NOT EXISTS dedup_data_ref date,
  ADD COLUMN IF NOT EXISTS dedup_head_norm text;

ALTER TABLE public.publicacoes_djen_descartadas
  ADD COLUMN IF NOT EXISTS dedup_processo_digits text,
  ADD COLUMN IF NOT EXISTS dedup_data_ref date,
  ADD COLUMN IF NOT EXISTS dedup_head_norm text;

CREATE OR REPLACE FUNCTION public.compute_dedup_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.dedup_processo_digits := regexp_replace(COALESCE(NEW.processo_numero, ''), '[^0-9]', '', 'g');
  NEW.dedup_data_ref := COALESCE(NEW.data_disponibilizacao::date, NEW.data_publicacao::date, NEW.created_at::date);
  NEW.dedup_head_norm := left(lower(regexp_replace(regexp_replace(regexp_replace(
    COALESCE(public.strip_destinatarios(NEW.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_dedup_pub_djen ON public.publicacoes_djen;
CREATE TRIGGER trg_compute_dedup_pub_djen
  BEFORE INSERT OR UPDATE ON public.publicacoes_djen
  FOR EACH ROW EXECUTE FUNCTION public.compute_dedup_fields();

DROP TRIGGER IF EXISTS trg_compute_dedup_pub_djen_proc ON public.publicacoes_djen_processos;
CREATE TRIGGER trg_compute_dedup_pub_djen_proc
  BEFORE INSERT OR UPDATE ON public.publicacoes_djen_processos
  FOR EACH ROW EXECUTE FUNCTION public.compute_dedup_fields();

DROP TRIGGER IF EXISTS trg_compute_dedup_pub_djen_desc ON public.publicacoes_djen_descartadas;
CREATE TRIGGER trg_compute_dedup_pub_djen_desc
  BEFORE INSERT OR UPDATE ON public.publicacoes_djen_descartadas
  FOR EACH ROW EXECUTE FUNCTION public.compute_dedup_fields();
