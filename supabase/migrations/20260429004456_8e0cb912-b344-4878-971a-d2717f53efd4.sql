-- Índices para dedup_key (acelera lookups e marcação de duplicados)
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_dedup_key 
  ON public.publicacoes_djen(dedup_key);

CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_processos_dedup_key 
  ON public.publicacoes_djen_processos(dedup_key);

-- Trigger para preencher dedup_key automaticamente em novos inserts/updates
CREATE OR REPLACE FUNCTION public.set_djen_dedup_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.dedup_key IS NULL THEN
    NEW.dedup_key := public.compute_djen_dedup_key(
      NEW.coordenacao_id, 
      NEW.processo_numero, 
      NEW.data_disponibilizacao, 
      NEW.data_publicacao, 
      NEW.created_at
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_dedup_key_publicacoes_djen ON public.publicacoes_djen;
CREATE TRIGGER trg_set_dedup_key_publicacoes_djen
  BEFORE INSERT OR UPDATE ON public.publicacoes_djen
  FOR EACH ROW EXECUTE FUNCTION public.set_djen_dedup_key();

DROP TRIGGER IF EXISTS trg_set_dedup_key_publicacoes_djen_processos ON public.publicacoes_djen_processos;
CREATE TRIGGER trg_set_dedup_key_publicacoes_djen_processos
  BEFORE INSERT OR UPDATE ON public.publicacoes_djen_processos
  FOR EACH ROW EXECUTE FUNCTION public.set_djen_dedup_key();