CREATE OR REPLACE FUNCTION public.rejeitar_kurier_sem_vinculo_coordenacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fonte = 'kurier' THEN
    IF NEW.coordenacao_id IS NULL THEN
      RAISE EXCEPTION 'Publicação Kurier sem coordenação vinculada não permitida';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.kurier_credencial_coordenacoes kc
      WHERE kc.coordenacao_id = NEW.coordenacao_id
    ) THEN
      RAISE EXCEPTION 'Publicação Kurier bloqueada: coordenação sem login Kurier vinculado';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rejeitar_kurier_sem_vinculo_coordenacao ON public.publicacoes_djen;

CREATE TRIGGER trg_rejeitar_kurier_sem_vinculo_coordenacao
BEFORE INSERT OR UPDATE OF fonte, coordenacao_id
ON public.publicacoes_djen
FOR EACH ROW
EXECUTE FUNCTION public.rejeitar_kurier_sem_vinculo_coordenacao();

WITH indevidas AS (
  SELECT p.id, p.hash_conteudo
  FROM public.publicacoes_djen p
  WHERE p.fonte = 'kurier'
    AND NOT EXISTS (
      SELECT 1
      FROM public.kurier_credencial_coordenacoes kc
      WHERE kc.coordenacao_id = p.coordenacao_id
    )
), limpar_leituras AS (
  DELETE FROM public.publicacoes_djen_leituras l
  USING indevidas i
  WHERE l.publicacao_id = i.id
), limpar_hash_id AS (
  DELETE FROM public.publicacoes_djen_global_hash gh
  USING indevidas i
  WHERE gh.publicacao_id = i.id
), limpar_hash_valor AS (
  DELETE FROM public.publicacoes_djen_global_hash gh
  USING indevidas i
  WHERE gh.hash_global = i.hash_conteudo
)
DELETE FROM public.publicacoes_djen p
USING indevidas i
WHERE p.id = i.id;