CREATE TABLE IF NOT EXISTS public.processos_partes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  documento TEXT,
  tipo_pessoa TEXT,
  polo TEXT,
  lado_efetivo TEXT,
  is_advogado BOOLEAN NOT NULL DEFAULT false,
  fonte TEXT NOT NULL DEFAULT 'judit',
  raw JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processos_partes_processo ON public.processos_partes(processo_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_processos_partes_dedup
  ON public.processos_partes(processo_id, COALESCE(NULLIF(regexp_replace(COALESCE(documento,''), '\D', '', 'g'), ''), upper(nome)), is_advogado, COALESCE(polo, ''));

ALTER TABLE public.processos_partes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View processos_partes by processo access"
  ON public.processos_partes FOR SELECT
  USING (is_user_active(auth.uid()) AND can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Insert processos_partes by processo access"
  ON public.processos_partes FOR INSERT
  WITH CHECK (is_user_active(auth.uid()) AND can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Update processos_partes by processo access"
  ON public.processos_partes FOR UPDATE
  USING (is_user_active(auth.uid()) AND can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Delete processos_partes by processo access"
  ON public.processos_partes FOR DELETE
  USING (is_user_active(auth.uid()) AND can_access_processo(auth.uid(), processo_id));

CREATE TRIGGER update_processos_partes_updated_at
  BEFORE UPDATE ON public.processos_partes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();