
-- Função que extrai número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO ou 20 dígitos) do texto
CREATE OR REPLACE FUNCTION public.extract_cnj_from_text(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_match text;
  v_digits text;
BEGIN
  IF p_text IS NULL OR length(p_text) = 0 THEN
    RETURN NULL;
  END IF;

  -- Padrão CNJ formatado: 0000000-00.0000.0.00.0000
  v_match := substring(p_text from '\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}');
  IF v_match IS NOT NULL THEN
    RETURN v_match;
  END IF;

  -- Procura sequência de 20 dígitos (CNJ sem formatação)
  v_match := substring(p_text from '\d{20}');
  IF v_match IS NOT NULL THEN
    RETURN v_match;
  END IF;

  RETURN NULL;
END;
$$;

-- Trigger BEFORE INSERT/UPDATE: garante processo_numero e dedup_processo_digits
CREATE OR REPLACE FUNCTION public.ensure_processo_numero_djen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_extracted text;
BEGIN
  -- Se processo_numero está vazio/nulo, tenta extrair do conteúdo
  IF NEW.processo_numero IS NULL OR length(trim(NEW.processo_numero)) = 0 THEN
    v_extracted := public.extract_cnj_from_text(NEW.conteudo);
    IF v_extracted IS NOT NULL THEN
      NEW.processo_numero := v_extracted;
    END IF;
  END IF;

  -- Sincroniza dedup_processo_digits a partir do processo_numero
  IF NEW.processo_numero IS NOT NULL
     AND (NEW.dedup_processo_digits IS NULL OR length(NEW.dedup_processo_digits) = 0) THEN
    NEW.dedup_processo_digits := regexp_replace(NEW.processo_numero, '\D', '', 'g');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_processo_numero_djen ON public.publicacoes_djen;
CREATE TRIGGER trg_ensure_processo_numero_djen
  BEFORE INSERT OR UPDATE OF processo_numero, conteudo
  ON public.publicacoes_djen
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_processo_numero_djen();

-- Backfill: tenta preencher processo_numero dos registros Kurier existentes
-- 1) A partir do raw payload (campo Processo) quando houver vínculo
UPDATE public.publicacoes_djen p
SET processo_numero = r.payload->>'Processo'
FROM public.kurier_publicacoes_raw r
WHERE p.id = r.publicacao_djen_id
  AND p.processo_numero IS NULL
  AND r.payload->>'Processo' IS NOT NULL
  AND length(r.payload->>'Processo') > 0;

-- 2) A partir do próprio conteúdo, via regex CNJ
UPDATE public.publicacoes_djen
SET processo_numero = public.extract_cnj_from_text(conteudo)
WHERE processo_numero IS NULL
  AND public.extract_cnj_from_text(conteudo) IS NOT NULL;

-- 3) Sincroniza dedup_processo_digits onde estiver vazio
UPDATE public.publicacoes_djen
SET dedup_processo_digits = regexp_replace(processo_numero, '\D', '', 'g')
WHERE processo_numero IS NOT NULL
  AND (dedup_processo_digits IS NULL OR length(dedup_processo_digits) = 0);
