CREATE TABLE public.prompts_ia_tst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  prompt text NOT NULL,
  descricao text,
  modelo text NOT NULL DEFAULT 'gemini-2.5-flash',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts_ia_tst TO authenticated;
GRANT ALL ON public.prompts_ia_tst TO service_role;

ALTER TABLE public.prompts_ia_tst ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_prompts_ia_tst_coordenacao ON public.prompts_ia_tst(coordenacao_id);
CREATE INDEX idx_prompts_ia_tst_ativo ON public.prompts_ia_tst(ativo);

CREATE POLICY "prompts_ia_tst_select"
ON public.prompts_ia_tst FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = prompts_ia_tst.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
);

CREATE POLICY "prompts_ia_tst_insert"
ON public.prompts_ia_tst FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = prompts_ia_tst.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
);

CREATE POLICY "prompts_ia_tst_update"
ON public.prompts_ia_tst FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = prompts_ia_tst.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = prompts_ia_tst.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
);

CREATE POLICY "prompts_ia_tst_delete"
ON public.prompts_ia_tst FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = prompts_ia_tst.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.prompts_ia_tst_set_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prompts_ia_tst_updated
BEFORE UPDATE ON public.prompts_ia_tst
FOR EACH ROW EXECUTE FUNCTION public.prompts_ia_tst_set_updated();