ALTER TABLE public.publicacoes_djen
  ADD COLUMN IF NOT EXISTS dedup_conteudo_key text,
  ADD COLUMN IF NOT EXISTS publicacao_unica boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.tg_publicacoes_djen_set_dedup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existe_anterior boolean;
BEGIN
  NEW.dedup_conteudo_key := public.compute_djen_conteudo_dedup_key(
    NEW.coordenacao_id, NEW.processo_numero, NEW.data_disponibilizacao,
    NEW.data_publicacao, NEW.created_at, NEW.conteudo);
  IF NEW.dedup_conteudo_key IS NULL THEN
    NEW.publicacao_unica := true; RETURN NEW;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.publicacoes_djen p
    WHERE p.id <> NEW.id
      AND p.coordenacao_id IS NOT DISTINCT FROM NEW.coordenacao_id
      AND p.dedup_conteudo_key = NEW.dedup_conteudo_key
      AND (p.data_disponibilizacao < NEW.data_disponibilizacao
        OR (p.data_disponibilizacao = NEW.data_disponibilizacao AND p.created_at < NEW.created_at)
        OR (p.data_disponibilizacao = NEW.data_disponibilizacao AND p.created_at = NEW.created_at AND p.id < NEW.id))
  ) INTO v_existe_anterior;
  NEW.publicacao_unica := NOT v_existe_anterior;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_publicacoes_djen_set_dedup ON public.publicacoes_djen;
CREATE TRIGGER trg_publicacoes_djen_set_dedup
BEFORE INSERT OR UPDATE OF conteudo, processo_numero, data_disponibilizacao, data_publicacao, coordenacao_id, id_djen
ON public.publicacoes_djen FOR EACH ROW EXECUTE FUNCTION public.tg_publicacoes_djen_set_dedup();

CREATE OR REPLACE FUNCTION public.tg_publicacoes_djen_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.publicacao_unica AND NEW.dedup_conteudo_key IS NOT NULL THEN
    UPDATE public.publicacoes_djen p SET publicacao_unica = false
     WHERE p.id <> NEW.id
       AND p.coordenacao_id IS NOT DISTINCT FROM NEW.coordenacao_id
       AND p.dedup_conteudo_key = NEW.dedup_conteudo_key
       AND p.publicacao_unica = true
       AND (p.data_disponibilizacao > NEW.data_disponibilizacao
         OR (p.data_disponibilizacao = NEW.data_disponibilizacao AND p.created_at > NEW.created_at)
         OR (p.data_disponibilizacao = NEW.data_disponibilizacao AND p.created_at = NEW.created_at AND p.id > NEW.id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_publicacoes_djen_after_change ON public.publicacoes_djen;
CREATE TRIGGER trg_publicacoes_djen_after_change
AFTER INSERT OR UPDATE OF publicacao_unica, dedup_conteudo_key
ON public.publicacoes_djen FOR EACH ROW EXECUTE FUNCTION public.tg_publicacoes_djen_after_change();

CREATE OR REPLACE FUNCTION public.tg_publicacoes_djen_after_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.publicacao_unica AND OLD.dedup_conteudo_key IS NOT NULL THEN
    UPDATE public.publicacoes_djen p SET publicacao_unica = true
     WHERE p.id = (SELECT id FROM public.publicacoes_djen p2
        WHERE p2.coordenacao_id IS NOT DISTINCT FROM OLD.coordenacao_id
          AND p2.dedup_conteudo_key = OLD.dedup_conteudo_key
        ORDER BY p2.data_disponibilizacao ASC, p2.created_at ASC, p2.id ASC LIMIT 1);
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_publicacoes_djen_after_delete ON public.publicacoes_djen;
CREATE TRIGGER trg_publicacoes_djen_after_delete
AFTER DELETE ON public.publicacoes_djen FOR EACH ROW EXECUTE FUNCTION public.tg_publicacoes_djen_after_delete();

CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_coord_dedup
  ON public.publicacoes_djen (coordenacao_id, dedup_conteudo_key);

CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_unica_coord_data
  ON public.publicacoes_djen (coordenacao_id, data_disponibilizacao)
  WHERE publicacao_unica = true;

CREATE OR REPLACE FUNCTION public.backfill_publicacoes_djen_unica(p_batch_size int DEFAULT 5000)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH lote AS (
    SELECT id FROM public.publicacoes_djen WHERE dedup_conteudo_key IS NULL LIMIT p_batch_size
  )
  UPDATE public.publicacoes_djen p
     SET dedup_conteudo_key = public.compute_djen_conteudo_dedup_key(
           p.coordenacao_id, p.processo_numero, p.data_disponibilizacao,
           p.data_publicacao, p.created_at, p.conteudo)
    FROM lote WHERE p.id = lote.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.rebuild_publicacoes_djen_unica_flags()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  WITH ranked AS (
    SELECT id, row_number() OVER (
             PARTITION BY coordenacao_id, dedup_conteudo_key
             ORDER BY data_disponibilizacao ASC, created_at ASC, id ASC) AS rn
      FROM public.publicacoes_djen WHERE dedup_conteudo_key IS NOT NULL
  )
  UPDATE public.publicacoes_djen p SET publicacao_unica = (r.rn = 1)
    FROM ranked r WHERE r.id = p.id AND p.publicacao_unica IS DISTINCT FROM (r.rn = 1);
END; $$;

GRANT EXECUTE ON FUNCTION public.backfill_publicacoes_djen_unica(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_publicacoes_djen_unica_flags() TO authenticated, service_role;
