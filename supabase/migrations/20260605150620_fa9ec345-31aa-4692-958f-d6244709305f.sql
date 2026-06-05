
-- Tabela de arquivados de Distribuição TST (dados_benner)
CREATE TABLE IF NOT EXISTS public.dados_benner_arquivados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dados_benner_id uuid NOT NULL,
  processo text,
  dossie text,
  aba_origem text,
  coordenacao_id uuid,
  snapshot jsonb NOT NULL,
  arquivado_em timestamptz NOT NULL DEFAULT now(),
  arquivado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  motivo text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dados_benner_arquivados TO authenticated;
GRANT ALL ON public.dados_benner_arquivados TO service_role;

ALTER TABLE public.dados_benner_arquivados ENABLE ROW LEVEL SECURITY;

-- Apenas administradores podem consultar/gerenciar arquivados
CREATE POLICY "Admins podem ver arquivados"
  ON public.dados_benner_arquivados FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar arquivados"
  ON public.dados_benner_arquivados FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert/update apenas via funções security definer
CREATE POLICY "Bloquear insert direto arquivados"
  ON public.dados_benner_arquivados FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Bloquear update direto arquivados"
  ON public.dados_benner_arquivados FOR UPDATE
  TO authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_dados_benner_arquivados_processo ON public.dados_benner_arquivados (processo);
CREATE INDEX IF NOT EXISTS idx_dados_benner_arquivados_dossie ON public.dados_benner_arquivados (dossie);
CREATE INDEX IF NOT EXISTS idx_dados_benner_arquivados_arquivado_em ON public.dados_benner_arquivados (arquivado_em DESC);

-- Função: arquivar (admin ou coordenador)
CREATE OR REPLACE FUNCTION public.arquivar_dados_benner(_id uuid, _motivo text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dados_benner%ROWTYPE;
  _snapshot jsonb;
  _archived_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador')) THEN
    RAISE EXCEPTION 'Apenas administradores ou coordenadores podem arquivar';
  END IF;

  SELECT * INTO _row FROM public.dados_benner WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado';
  END IF;

  SELECT to_jsonb(_row) INTO _snapshot;

  INSERT INTO public.dados_benner_arquivados
    (dados_benner_id, processo, dossie, aba_origem, coordenacao_id, snapshot, arquivado_por, motivo)
  VALUES
    (_row.id, _row.processo, _row.dossie, _row.aba_origem, _row.coordenacao_id, _snapshot, auth.uid(), _motivo)
  RETURNING id INTO _archived_id;

  DELETE FROM public.dados_benner WHERE id = _id;
  RETURN _archived_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.arquivar_dados_benner(uuid, text) TO authenticated;

-- Função: restaurar (apenas admin)
CREATE OR REPLACE FUNCTION public.restaurar_dados_benner_arquivado(_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _snapshot jsonb;
  _restored_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem restaurar';
  END IF;

  SELECT snapshot INTO _snapshot FROM public.dados_benner_arquivados WHERE id = _id;
  IF _snapshot IS NULL THEN
    RAISE EXCEPTION 'Arquivo não encontrado';
  END IF;

  INSERT INTO public.dados_benner SELECT * FROM jsonb_populate_record(NULL::public.dados_benner, _snapshot)
  RETURNING id INTO _restored_id;

  DELETE FROM public.dados_benner_arquivados WHERE id = _id;
  RETURN _restored_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restaurar_dados_benner_arquivado(uuid) TO authenticated;
