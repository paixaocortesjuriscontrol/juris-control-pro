
ALTER TABLE public.publicacoes_djen ADD COLUMN IF NOT EXISTS coordenacao_id uuid;
ALTER TABLE public.publicacoes_djen_processos ADD COLUMN IF NOT EXISTS coordenacao_id uuid;

CREATE OR REPLACE FUNCTION public.set_pub_djen_coordenacao_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.monitoramento_id IS NOT NULL AND (NEW.coordenacao_id IS NULL OR (TG_OP='UPDATE' AND NEW.monitoramento_id IS DISTINCT FROM OLD.monitoramento_id)) THEN
    SELECT md.coordenacao_id INTO NEW.coordenacao_id FROM public.monitoramentos_djen md WHERE md.id = NEW.monitoramento_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_pub_djen_coord ON public.publicacoes_djen;
CREATE TRIGGER trg_set_pub_djen_coord BEFORE INSERT OR UPDATE ON public.publicacoes_djen
FOR EACH ROW EXECUTE FUNCTION public.set_pub_djen_coordenacao_id();

CREATE OR REPLACE FUNCTION public.set_pub_djen_proc_coordenacao_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.processo_id IS NOT NULL AND (NEW.coordenacao_id IS NULL OR (TG_OP='UPDATE' AND NEW.processo_id IS DISTINCT FROM OLD.processo_id)) THEN
    SELECT p.coordenacao_id INTO NEW.coordenacao_id FROM public.processos p WHERE p.id = NEW.processo_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_pub_djen_proc_coord ON public.publicacoes_djen_processos;
CREATE TRIGGER trg_set_pub_djen_proc_coord BEFORE INSERT OR UPDATE ON public.publicacoes_djen_processos
FOR EACH ROW EXECUTE FUNCTION public.set_pub_djen_proc_coordenacao_id();

CREATE INDEX IF NOT EXISTS idx_pub_djen_coord_created
  ON public.publicacoes_djen (coordenacao_id, created_at DESC)
  WHERE coordenacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_djen_coord_lida_created
  ON public.publicacoes_djen (coordenacao_id, created_at DESC)
  WHERE coordenacao_id IS NOT NULL AND lida = false;

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_coord_created
  ON public.publicacoes_djen_processos (coordenacao_id, created_at DESC)
  WHERE coordenacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_coord_lida_created
  ON public.publicacoes_djen_processos (coordenacao_id, created_at DESC)
  WHERE coordenacao_id IS NOT NULL AND lida = false;
