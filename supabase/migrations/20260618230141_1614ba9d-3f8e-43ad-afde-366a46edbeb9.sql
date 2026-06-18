
-- 1) Coluna denormalizada
ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS tem_responsavel boolean NOT NULL DEFAULT false;

-- 2) Backfill
UPDATE public.dados_benner d
SET tem_responsavel = EXISTS (
  SELECT 1 FROM public.dados_benner_responsaveis r WHERE r.dados_benner_id = d.id
)
WHERE d.tem_responsavel IS DISTINCT FROM EXISTS (
  SELECT 1 FROM public.dados_benner_responsaveis r WHERE r.dados_benner_id = d.id
);

-- 3) Índice parcial otimiza filtro "sem responsável"
CREATE INDEX IF NOT EXISTS idx_dados_benner_sem_responsavel
  ON public.dados_benner (updated_at DESC)
  WHERE tem_responsavel = false;

-- 4) Trigger para manter a coluna sincronizada
CREATE OR REPLACE FUNCTION public.sync_dados_benner_tem_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _target := OLD.dados_benner_id;
  ELSE
    _target := NEW.dados_benner_id;
  END IF;

  UPDATE public.dados_benner
  SET tem_responsavel = EXISTS (
    SELECT 1 FROM public.dados_benner_responsaveis r WHERE r.dados_benner_id = _target
  )
  WHERE id = _target;

  -- Quando UPDATE muda o vínculo para outro dados_benner_id, atualiza ambos
  IF TG_OP = 'UPDATE' AND OLD.dados_benner_id IS DISTINCT FROM NEW.dados_benner_id THEN
    UPDATE public.dados_benner
    SET tem_responsavel = EXISTS (
      SELECT 1 FROM public.dados_benner_responsaveis r WHERE r.dados_benner_id = OLD.dados_benner_id
    )
    WHERE id = OLD.dados_benner_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dados_benner_tem_responsavel ON public.dados_benner_responsaveis;
CREATE TRIGGER trg_sync_dados_benner_tem_responsavel
AFTER INSERT OR UPDATE OR DELETE ON public.dados_benner_responsaveis
FOR EACH ROW EXECUTE FUNCTION public.sync_dados_benner_tem_responsavel();
