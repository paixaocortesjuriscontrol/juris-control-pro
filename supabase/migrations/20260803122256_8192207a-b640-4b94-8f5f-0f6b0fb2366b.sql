CREATE TABLE public.auditoria_distribuicao_tst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  dados_benner_id uuid,
  processo text,
  processo_digits text,
  dossie text,
  equipe text,
  coordenacao_id uuid,
  usuario_id uuid,
  acao text NOT NULL,
  origem text,
  dados_antes jsonb,
  dados_depois jsonb,
  campos_alterados jsonb
);

GRANT SELECT ON public.auditoria_distribuicao_tst TO authenticated;
GRANT ALL ON public.auditoria_distribuicao_tst TO service_role;

ALTER TABLE public.auditoria_distribuicao_tst ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver auditoria da distribuicao TST"
ON public.auditoria_distribuicao_tst
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role gerencia auditoria da distribuicao TST"
ON public.auditoria_distribuicao_tst
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_aud_dist_tst_created_at ON public.auditoria_distribuicao_tst (created_at DESC);
CREATE INDEX idx_aud_dist_tst_registro ON public.auditoria_distribuicao_tst (dados_benner_id, created_at DESC);
CREATE INDEX idx_aud_dist_tst_processo_digits ON public.auditoria_distribuicao_tst (processo_digits);
CREATE INDEX idx_aud_dist_tst_dossie ON public.auditoria_distribuicao_tst (dossie);
CREATE INDEX idx_aud_dist_tst_usuario ON public.auditoria_distribuicao_tst (usuario_id);
CREATE INDEX idx_aud_dist_tst_coordenacao ON public.auditoria_distribuicao_tst (coordenacao_id);

CREATE OR REPLACE FUNCTION public.audit_dados_benner_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_antes jsonb;
  v_depois jsonb;
  v_diff jsonb := '[]'::jsonb;
  v_key text;
  v_acao text;
  v_row jsonb;
  v_origem text;
  ignorar text[] := ARRAY['updated_at','created_at','atualizado_em','data_atualizacao'];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_acao := 'atualizar';
    v_antes := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_depois) LOOP
      IF v_key = ANY(ignorar) THEN CONTINUE; END IF;
      IF (v_antes -> v_key) IS DISTINCT FROM (v_depois -> v_key) THEN
        v_diff := v_diff || jsonb_build_object('campo', v_key, 'de', v_antes -> v_key, 'para', v_depois -> v_key);
      END IF;
    END LOOP;
    IF jsonb_array_length(v_diff) = 0 THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'deletar';
    v_antes := to_jsonb(OLD);
    v_depois := NULL;
  ELSE
    v_acao := 'criar';
    v_antes := NULL;
    v_depois := to_jsonb(NEW);
  END IF;

  v_row := COALESCE(v_depois, v_antes);
  v_origem := NULLIF(current_setting('app.audit_origem', true), '');

  INSERT INTO public.auditoria_distribuicao_tst (
    dados_benner_id, processo, processo_digits, dossie, equipe, coordenacao_id,
    usuario_id, acao, origem, dados_antes, dados_depois, campos_alterados
  ) VALUES (
    NULLIF(v_row ->> 'id','')::uuid,
    v_row ->> 'processo',
    NULLIF(regexp_replace(COALESCE(v_row ->> 'processo',''), '[^0-9]', '', 'g'), ''),
    v_row ->> 'dossie',
    v_row ->> 'equipe',
    NULLIF(v_row ->> 'coordenacao_id','')::uuid,
    auth.uid(),
    v_acao,
    COALESCE(v_origem, 'desconhecida'),
    v_antes,
    v_depois,
    CASE WHEN TG_OP = 'UPDATE' THEN v_diff ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_dados_benner ON public.dados_benner;
CREATE TRIGGER trg_audit_dados_benner
AFTER INSERT OR UPDATE OR DELETE ON public.dados_benner
FOR EACH ROW EXECUTE FUNCTION public.audit_dados_benner_changes();

CREATE OR REPLACE FUNCTION public.limpar_auditoria_distribuicao_tst_antiga()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  DELETE FROM public.auditoria_distribuicao_tst
  WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;