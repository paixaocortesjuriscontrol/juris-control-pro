-- Restaura o comportamento de deduplicação por (coordenação + monitoramento + processo + dia + head)
-- antes da classificação pré-gravação, a chave incluía o vínculo com o monitoramento que capturou.
-- Sem isso, capturas legítimas de termos distintos da mesma coordenação são marcadas como duplicadas.

CREATE OR REPLACE FUNCTION public.mark_djen_duplicada_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.coordenacao_id IS NULL AND NEW.monitoramento_id IS NOT NULL THEN
    SELECT md.coordenacao_id INTO NEW.coordenacao_id
    FROM public.monitoramentos_djen md
    WHERE md.id = NEW.monitoramento_id;
  END IF;

  NEW.dedup_key := public.compute_djen_dedup_key(
    NEW.coordenacao_id, NEW.processo_numero,
    NEW.data_disponibilizacao, NEW.data_publicacao, COALESCE(NEW.created_at, now())
  );

  NEW.dedup_processo_digits := regexp_replace(COALESCE(NEW.processo_numero, ''), '[^0-9]', '', 'g');
  NEW.dedup_data_ref := COALESCE(NEW.data_disponibilizacao::date, NEW.data_publicacao::date, COALESCE(NEW.created_at, now())::date);
  NEW.dedup_head_norm := left(lower(regexp_replace(regexp_replace(regexp_replace(
    COALESCE(public.strip_destinatarios(NEW.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300);

  IF NEW.status = 'descartada' THEN RETURN NEW; END IF;

  -- IMPORTANTE: a chave de duplicidade agora inclui monitoramento_id.
  -- Isso restaura o comportamento que existia antes da classificação pré-gravação:
  -- a mesma publicação capturada por termos/monitoramentos diferentes da mesma coordenação
  -- aparece como entradas distintas (não é colapsada como duplicada).
  IF EXISTS (
    SELECT 1
    FROM public.publicacoes_djen pd
    WHERE pd.status = 'encontrada'
      AND pd.id <> NEW.id
      AND pd.coordenacao_id IS NOT DISTINCT FROM NEW.coordenacao_id
      AND pd.monitoramento_id IS NOT DISTINCT FROM NEW.monitoramento_id
      AND pd.dedup_processo_digits IS NOT DISTINCT FROM NEW.dedup_processo_digits
      AND pd.dedup_data_ref IS NOT DISTINCT FROM NEW.dedup_data_ref
      AND pd.dedup_head_norm IS NOT DISTINCT FROM NEW.dedup_head_norm
  ) THEN
    NEW.status := 'duplicada';
  ELSE
    NEW.status := 'encontrada';
  END IF;

  RETURN NEW;
END;
$$;

-- Índice de apoio para o novo lookup do trigger (inclui monitoramento_id)
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_dedup_lookup_v2
  ON public.publicacoes_djen (coordenacao_id, monitoramento_id, dedup_processo_digits, dedup_data_ref, dedup_head_norm)
  WHERE status = 'encontrada';

-- Reclassifica retroativamente as publicações de hoje que foram marcadas como duplicada
-- pela regra antiga (sem monitoramento_id) e que, pela nova regra, são únicas para o
-- seu monitoramento. Restringe escopo a 48h para evitar reescrever histórico antigo.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY coordenacao_id, monitoramento_id, dedup_processo_digits, dedup_data_ref, dedup_head_norm
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.publicacoes_djen
  WHERE status IN ('encontrada', 'duplicada')
    AND created_at >= NOW() - INTERVAL '48 hours'
)
UPDATE public.publicacoes_djen p
SET status = CASE WHEN r.rn = 1 THEN 'encontrada'::djen_status ELSE 'duplicada'::djen_status END
FROM ranked r
WHERE p.id = r.id
  AND p.status IS DISTINCT FROM (CASE WHEN r.rn = 1 THEN 'encontrada'::djen_status ELSE 'duplicada'::djen_status END);
