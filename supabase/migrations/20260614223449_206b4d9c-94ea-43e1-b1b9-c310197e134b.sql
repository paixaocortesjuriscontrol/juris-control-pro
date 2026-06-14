
-- 1. Add archive fields
ALTER TABLE public.monitoramentos_djen
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_por uuid;

CREATE INDEX IF NOT EXISTS idx_monitoramentos_djen_arquivado ON public.monitoramentos_djen(arquivado);

-- 2. Remove DELETE policy (no more deletions)
DROP POLICY IF EXISTS "Users can delete accessible monitoramentos" ON public.monitoramentos_djen;

-- 3. Trigger to restrict archive changes to admins
CREATE OR REPLACE FUNCTION public.tg_monitoramentos_djen_restrict_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.arquivado, false) IS DISTINCT FROM COALESCE(OLD.arquivado, false) THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Apenas administradores podem arquivar ou desarquivar termos DJEN';
    END IF;
    NEW.arquivado_em := CASE WHEN NEW.arquivado THEN now() ELSE NULL END;
    NEW.arquivado_por := CASE WHEN NEW.arquivado THEN auth.uid() ELSE NULL END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_monitoramentos_djen_restrict_archive ON public.monitoramentos_djen;
CREATE TRIGGER trg_monitoramentos_djen_restrict_archive
  BEFORE UPDATE ON public.monitoramentos_djen
  FOR EACH ROW EXECUTE FUNCTION public.tg_monitoramentos_djen_restrict_archive();

-- 4. Audit trail table
CREATE TABLE IF NOT EXISTS public.monitoramentos_djen_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitoramento_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('criacao','edicao','arquivamento','desarquivamento')),
  alterado_por uuid,
  alterado_em timestamptz NOT NULL DEFAULT now(),
  dados_antes jsonb,
  dados_depois jsonb,
  campos_alterados text[]
);

CREATE INDEX IF NOT EXISTS idx_mon_djen_audit_mon ON public.monitoramentos_djen_auditoria(monitoramento_id, alterado_em DESC);

GRANT SELECT ON public.monitoramentos_djen_auditoria TO authenticated;
GRANT ALL ON public.monitoramentos_djen_auditoria TO service_role;

ALTER TABLE public.monitoramentos_djen_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view DJEN audit trail"
  ON public.monitoramentos_djen_auditoria
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Trigger to capture audit trail
CREATE OR REPLACE FUNCTION public.tg_monitoramentos_djen_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao text;
  v_campos text[] := ARRAY[]::text[];
  v_antes jsonb;
  v_depois jsonb;
  k text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'criacao';
    v_antes := NULL;
    v_depois := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_antes := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);

    IF COALESCE(NEW.arquivado, false) IS DISTINCT FROM COALESCE(OLD.arquivado, false) THEN
      v_acao := CASE WHEN NEW.arquivado THEN 'arquivamento' ELSE 'desarquivamento' END;
    ELSE
      v_acao := 'edicao';
    END IF;

    FOR k IN SELECT jsonb_object_keys(v_depois) LOOP
      IF v_antes->k IS DISTINCT FROM v_depois->k AND k NOT IN ('updated_at') THEN
        v_campos := array_append(v_campos, k);
      END IF;
    END LOOP;

    IF array_length(v_campos, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.monitoramentos_djen_auditoria
    (monitoramento_id, acao, alterado_por, dados_antes, dados_depois, campos_alterados)
  VALUES
    (NEW.id, v_acao, auth.uid(), v_antes, v_depois, v_campos);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_monitoramentos_djen_audit ON public.monitoramentos_djen;
CREATE TRIGGER trg_monitoramentos_djen_audit
  AFTER INSERT OR UPDATE ON public.monitoramentos_djen
  FOR EACH ROW EXECUTE FUNCTION public.tg_monitoramentos_djen_audit();
