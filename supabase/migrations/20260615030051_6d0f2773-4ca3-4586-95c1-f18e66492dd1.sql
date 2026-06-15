CREATE OR REPLACE FUNCTION public.compute_dedup_fields_servidor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.dedup_processo_digits := regexp_replace(COALESCE(NEW.processo_numero, ''), '[^0-9]', '', 'g');
  NEW.dedup_data_ref := COALESCE(NEW.data_disponibilizacao::date, NEW.data_publicacao::date, NEW.created_at::date);
  NEW.dedup_head_norm := left(lower(regexp_replace(regexp_replace(regexp_replace(
    COALESCE(public.strip_destinatarios(NEW.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300);
  NEW.dedup_key := public.compute_djen_dedup_key(
    NEW.coordenacao_id,
    NEW.processo_numero,
    NEW.data_disponibilizacao,
    NEW.data_publicacao,
    NEW.created_at
  );
  NEW.dedup_conteudo_key := public.compute_djen_conteudo_dedup_key(
    NEW.coordenacao_id,
    NEW.processo_numero,
    NEW.data_disponibilizacao,
    NEW.data_publicacao,
    NEW.created_at,
    NEW.conteudo
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_dedup_pub_djen_servidor ON public.publicacoes_djen_servidor;
CREATE TRIGGER trg_compute_dedup_pub_djen_servidor
BEFORE INSERT OR UPDATE OF conteudo, processo_numero, data_disponibilizacao, data_publicacao, coordenacao_id, id_djen
ON public.publicacoes_djen_servidor
FOR EACH ROW
EXECUTE FUNCTION public.compute_dedup_fields_servidor();

UPDATE public.publicacoes_djen_servidor
SET conteudo = conteudo
WHERE dedup_data_ref IS NULL
   OR dedup_processo_digits IS NULL
   OR dedup_key IS NULL
   OR dedup_conteudo_key IS NULL;

GRANT SELECT, UPDATE ON public.configuracoes_monitoramento_servidor TO authenticated;
GRANT EXECUTE ON FUNCTION public.enfileirar_execucao_servidor(text, timestamptz, jsonb) TO authenticated;

DROP POLICY IF EXISTS "Autenticados atualizam configs servidor" ON public.configuracoes_monitoramento_servidor;
CREATE POLICY "Autenticados atualizam configs servidor"
ON public.configuracoes_monitoramento_servidor
FOR UPDATE
TO authenticated
USING (is_admin_or_coordenador(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (is_admin_or_coordenador(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_pub_djen_servidor_dedup_ref
ON public.publicacoes_djen_servidor(dedup_data_ref);

CREATE INDEX IF NOT EXISTS idx_pub_djen_servidor_conteudo_key
ON public.publicacoes_djen_servidor(coordenacao_id, dedup_conteudo_key)
WHERE dedup_conteudo_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_djen_servidor_id_djen
ON public.publicacoes_djen_servidor(coordenacao_id, id_djen)
WHERE id_djen IS NOT NULL;